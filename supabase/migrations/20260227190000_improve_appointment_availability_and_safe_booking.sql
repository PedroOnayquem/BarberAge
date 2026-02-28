-- Improve slot generation to respect service duration + buffer and add atomic safe booking RPC.

alter table if exists public.shops
  add column if not exists slot_interval_minutes integer not null default 30,
  add column if not exists buffer_minutes integer not null default 0;

alter table if exists public.shops
  drop constraint if exists shops_slot_interval_minutes_check;

alter table if exists public.shops
  add constraint shops_slot_interval_minutes_check
  check (slot_interval_minutes between 5 and 120);

alter table if exists public.shops
  drop constraint if exists shops_buffer_minutes_check;

alter table if exists public.shops
  add constraint shops_buffer_minutes_check
  check (buffer_minutes between 0 and 120);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'barbershops'
      and table_type = 'BASE TABLE'
  ) then
    execute $sql$
      alter table public.barbershops
        add column if not exists slot_interval_minutes integer not null default 30,
        add column if not exists buffer_minutes integer not null default 0
    $sql$;

    execute 'alter table public.barbershops drop constraint if exists barbershops_slot_interval_minutes_check';
    execute 'alter table public.barbershops add constraint barbershops_slot_interval_minutes_check check (slot_interval_minutes between 5 and 120)';

    execute 'alter table public.barbershops drop constraint if exists barbershops_buffer_minutes_check';
    execute 'alter table public.barbershops add constraint barbershops_buffer_minutes_check check (buffer_minutes between 0 and 120)';
  end if;
end;
$$;

-- Refresh compatibility view when canonical source is shops.
do $$
begin
  if to_regclass('public.shops') is not null
     and exists (
       select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = 'barbershops'
         and c.relkind = 'v'
     ) then
    execute 'create or replace view public.barbershops as select * from public.shops';
  end if;
end;
$$;

create or replace function public.ceil_to_interval(
  p_timestamp timestamptz,
  p_interval_minutes integer
)
returns timestamptz
language sql
immutable
as $$
  select
    'epoch'::timestamptz
    + ceil(
      extract(epoch from p_timestamp)
      / (greatest(coalesce(p_interval_minutes, 1), 1) * 60)::numeric
    ) * (greatest(coalesce(p_interval_minutes, 1), 1) * interval '1 minute');
$$;

drop function if exists public.get_available_slots(uuid, uuid, text, integer);

create or replace function public.get_available_slots(
  p_shop_id uuid,
  p_professional_id uuid,
  p_date text,
  p_duration_minutes integer
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_timezone text := 'America/Sao_Paulo';
  v_start_time time;
  v_end_time time;
  v_duration_minutes integer := greatest(coalesce(p_duration_minutes, 30), 5);
  v_slot_interval_minutes integer := 30;
  v_buffer_minutes integer := 0;
  v_total_minutes integer;
  v_weekday integer;
begin
  if p_shop_id is null or p_professional_id is null then
    return;
  end if;

  begin
    v_date := p_date::date;
  exception
    when others then
      raise exception 'Formato de data invalido. Use YYYY-MM-DD.';
  end;

  select
    coalesce(nullif(s.timezone, ''), 'America/Sao_Paulo'),
    greatest(coalesce(s.slot_interval_minutes, 30), 5),
    greatest(coalesce(s.buffer_minutes, 0), 0)
  into v_timezone, v_slot_interval_minutes, v_buffer_minutes
  from public.shops s
  where s.id = p_shop_id;

  if v_timezone is null then
    v_timezone := 'America/Sao_Paulo';
  end if;

  -- Requires an active professional from the same shop.
  if not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.shop_id = p_shop_id
      and coalesce(p.active, true)
  ) then
    return;
  end if;

  v_total_minutes := v_duration_minutes + v_buffer_minutes;
  v_weekday := extract(dow from v_date)::integer;

  select bh.start_time, bh.end_time
  into v_start_time, v_end_time
  from public.business_hours bh
  where bh.shop_id = p_shop_id
    and bh.weekday = v_weekday
    and coalesce(bh.closed, false) = false
    and bh.start_time is not null
    and bh.end_time is not null
  limit 1;

  if v_start_time is null or v_end_time is null then
    return;
  end if;

  if v_start_time >= v_end_time then
    return;
  end if;

  return query
  with day_window as (
    select
      ((v_date::timestamp + v_start_time) at time zone v_timezone) as window_start,
      ((v_date::timestamp + v_end_time) at time zone v_timezone) as window_end
  ),
  aligned_window as (
    select
      public.ceil_to_interval(dw.window_start, v_slot_interval_minutes) as first_slot,
      dw.window_end
    from day_window dw
  ),
  candidates as (
    select
      gs as slot_start,
      gs + make_interval(mins => v_total_minutes) as slot_end
    from aligned_window aw
    cross join lateral generate_series(
      aw.first_slot,
      aw.window_end - make_interval(mins => v_total_minutes),
      make_interval(mins => v_slot_interval_minutes)
    ) as gs
  )
  select c.slot_start, c.slot_end
  from candidates c
  where c.slot_start >= now()
    and not exists (
      select 1
      from public.appointments a
      where a.shop_id = p_shop_id
        and a.professional_id = p_professional_id
        and a.status in ('pending', 'confirmed')
        and a.start_at < c.slot_end
        and a.end_at > c.slot_start
    )
    and not exists (
      select 1
      from public.time_off t
      where t.shop_id = p_shop_id
        and (t.professional_id is null or t.professional_id = p_professional_id)
        and t.start_at < c.slot_end
        and t.end_at > c.slot_start
    )
  order by c.slot_start;
end;
$$;

drop function if exists public.create_appointment_safe(uuid, uuid, uuid, timestamptz, uuid[], text);

create or replace function public.create_appointment_safe(
  p_shop_id uuid,
  p_client_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_service_ids uuid[],
  p_notes text default null
)
returns table (
  appointment_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes integer,
  buffer_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_is_member boolean := false;
  v_is_client_owner boolean := false;
  v_timezone text := 'America/Sao_Paulo';
  v_buffer_minutes integer := 0;
  v_total_duration integer := 0;
  v_requested_count integer := 0;
  v_valid_count integer := 0;
  v_end_at timestamptz;
  v_appt_id uuid;
  v_day_key text;
  v_lock_key bigint;
begin
  if v_auth_user is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if p_shop_id is null or p_client_id is null or p_professional_id is null or p_start_at is null then
    raise exception 'Parametros obrigatorios ausentes.' using errcode = 'P0001';
  end if;

  v_requested_count := coalesce(cardinality(p_service_ids), 0);
  if v_requested_count = 0 then
    raise exception 'Selecione ao menos um servico.' using errcode = 'P0001';
  end if;

  select
    coalesce(nullif(s.timezone, ''), 'America/Sao_Paulo'),
    greatest(coalesce(s.buffer_minutes, 0), 0)
  into v_timezone, v_buffer_minutes
  from public.shops s
  where s.id = p_shop_id;

  if not found then
    raise exception 'Barbearia nao encontrada.' using errcode = 'P0001';
  end if;

  select exists(
    select 1
    from public.shop_members sm
    where sm.shop_id = p_shop_id
      and sm.user_id = v_auth_user
  )
  into v_is_member;

  select exists(
    select 1
    from public.client_users cu
    where cu.shop_id = p_shop_id
      and cu.client_id = p_client_id
      and cu.user_id = v_auth_user
  )
  into v_is_client_owner;

  if not v_is_member and not v_is_client_owner then
    raise exception 'Sem permissao para criar este agendamento.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.shop_id = p_shop_id
      and coalesce(p.active, true)
  ) then
    raise exception 'Profissional invalido.' using errcode = 'P0001';
  end if;

  select count(*), coalesce(sum(s.duration_minutes), 0)
  into v_valid_count, v_total_duration
  from public.services s
  where s.shop_id = p_shop_id
    and coalesce(s.active, true)
    and s.id = any(p_service_ids);

  if v_valid_count <> v_requested_count then
    raise exception 'Servico invalido para esta barbearia.' using errcode = 'P0001';
  end if;

  if v_total_duration <= 0 then
    raise exception 'Duracao total invalida.' using errcode = 'P0001';
  end if;

  v_end_at := p_start_at + make_interval(mins => (v_total_duration + v_buffer_minutes));

  if p_start_at < now() then
    raise exception 'Nao e possivel agendar no passado.' using errcode = 'P0001';
  end if;

  if not exists (
    with local_window as (
      select
        (p_start_at at time zone v_timezone)::date as local_start_date,
        (v_end_at at time zone v_timezone)::date as local_end_date,
        (p_start_at at time zone v_timezone)::time as local_start_time,
        (v_end_at at time zone v_timezone)::time as local_end_time,
        extract(dow from (p_start_at at time zone v_timezone))::integer as local_weekday
    )
    select 1
    from local_window lw
    join public.business_hours bh
      on bh.shop_id = p_shop_id
     and bh.weekday = lw.local_weekday
    where lw.local_start_date = lw.local_end_date
      and coalesce(bh.closed, false) = false
      and bh.start_time is not null
      and bh.end_time is not null
      and lw.local_start_time >= bh.start_time
      and lw.local_end_time <= bh.end_time
  ) then
    raise exception 'Horario fora do expediente.' using errcode = 'P0001';
  end if;

  v_day_key := (p_start_at at time zone v_timezone)::date::text;
  v_lock_key := hashtextextended(
    concat_ws(':', 'appointments', p_professional_id::text, v_day_key),
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  if exists (
    select 1
    from public.time_off t
    where t.shop_id = p_shop_id
      and (t.professional_id is null or t.professional_id = p_professional_id)
      and t.start_at < v_end_at
      and t.end_at > p_start_at
  ) then
    raise exception 'Horario indisponivel' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.shop_id = p_shop_id
      and a.professional_id = p_professional_id
      and a.status in ('pending', 'confirmed')
      and a.start_at < v_end_at
      and a.end_at > p_start_at
  ) then
    raise exception 'Horario indisponivel' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    shop_id,
    client_id,
    professional_id,
    start_at,
    end_at,
    notes,
    status
  )
  values (
    p_shop_id,
    p_client_id,
    p_professional_id,
    p_start_at,
    v_end_at,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending'
  )
  returning id into v_appt_id;

  insert into public.appointment_services (
    appointment_id,
    service_id,
    duration_minutes,
    price
  )
  select
    v_appt_id,
    s.id,
    s.duration_minutes,
    s.price
  from public.services s
  where s.shop_id = p_shop_id
    and s.id = any(p_service_ids);

  return query
  select
    v_appt_id,
    p_start_at,
    v_end_at,
    v_total_duration,
    v_buffer_minutes;

exception
  when exclusion_violation then
    raise exception 'Horario indisponivel' using errcode = 'P0001';
end;
$$;

revoke all on function public.get_available_slots(uuid, uuid, text, integer) from public;
grant execute on function public.get_available_slots(uuid, uuid, text, integer) to anon;
grant execute on function public.get_available_slots(uuid, uuid, text, integer) to authenticated;

revoke all on function public.create_appointment_safe(uuid, uuid, uuid, timestamptz, uuid[], text) from public;
grant execute on function public.create_appointment_safe(uuid, uuid, uuid, timestamptz, uuid[], text) to authenticated;
