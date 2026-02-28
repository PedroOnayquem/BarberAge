-- Fix ambiguous overloaded RPC signature for get_available_slots.
-- Some environments have both:
--   get_available_slots(uuid, uuid, date, integer)
--   get_available_slots(uuid, uuid, text, integer)
-- PostgREST RPC with named JSON args becomes ambiguous (PGRST203).

drop function if exists public.get_available_slots(uuid, uuid, date, integer);
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

revoke all on function public.get_available_slots(uuid, uuid, text, integer) from public;
grant execute on function public.get_available_slots(uuid, uuid, text, integer) to anon;
grant execute on function public.get_available_slots(uuid, uuid, text, integer) to authenticated;
