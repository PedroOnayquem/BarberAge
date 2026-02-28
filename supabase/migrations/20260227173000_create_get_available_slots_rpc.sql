-- Recreate public slot RPC with deterministic timezone behavior and explicit grants.

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
  v_weekday integer;
begin
  if p_shop_id is null or p_professional_id is null then
    return;
  end if;

  begin
    v_date := p_date::date;
  exception
    when others then
      raise exception 'Invalid date format. Expected YYYY-MM-DD.';
  end;

  select coalesce(nullif(s.timezone, ''), 'America/Sao_Paulo')
  into v_timezone
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
  candidates as (
    select
      gs as slot_start,
      gs + make_interval(mins => v_duration_minutes) as slot_end
    from day_window dw
    cross join lateral generate_series(
      dw.window_start,
      dw.window_end - make_interval(mins => v_duration_minutes),
      interval '15 minutes'
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
