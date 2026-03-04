-- Prefer canonical `public.shops` as marketplace source when both relations exist.
-- This avoids slug/id mismatches when `public.barbershops` is a legacy compatibility relation.

create or replace function public.list_public_barbershops_with_status()
returns table (
  id uuid,
  name text,
  slug text,
  address text,
  neighborhood text,
  city text,
  state text,
  avatar_url text,
  services_count integer,
  professionals_count integer,
  schedule_configured boolean,
  catalog_active boolean,
  can_book boolean,
  missing_reasons text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_table text;
  source_relation text;
  catalog_expr text := 'true';
  neighborhood_expr text := 'null::text';
  city_expr text := 'null::text';
  state_expr text := 'null::text';
begin
  -- Canonical preference: `shops` first, then `barbershops` as fallback.
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'shops'
  ) then
    source_table := 'shops';
  elsif exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'barbershops'
  ) then
    source_table := 'barbershops';
  else
    return;
  end if;

  source_relation := format('public.%I', source_table);

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = source_table
      and column_name = 'catalog_active'
  ) then
    catalog_expr := 'coalesce(s.catalog_active, true)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = source_table
      and column_name = 'published'
  ) then
    catalog_expr := 'coalesce(s.published, true)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = source_table
      and column_name = 'is_active'
  ) then
    catalog_expr := 'coalesce(s.is_active, true)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = source_table
      and column_name = 'neighborhood'
  ) then
    neighborhood_expr := 's.neighborhood';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = source_table
      and column_name = 'city'
  ) then
    city_expr := 's.city';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = source_table
      and column_name = 'state'
  ) then
    state_expr := 's.state';
  end if;

  return query execute format(
    $sql$
      with service_counts as (
        select sv.shop_id, count(*)::integer as services_count
        from public.services sv
        where sv.active = true
        group by sv.shop_id
      ),
      professional_counts as (
        select pr.shop_id, count(*)::integer as professionals_count
        from public.professionals pr
        where pr.active = true
        group by pr.shop_id
      ),
      schedule_flags as (
        select
          bh.shop_id,
          bool_or(
            bh.closed = false
            and bh.start_time is not null
            and bh.end_time is not null
          ) as schedule_configured
        from public.business_hours bh
        group by bh.shop_id
      )
      select
        s.id,
        s.name,
        s.slug,
        s.address,
        %2$s as neighborhood,
        %3$s as city,
        %4$s as state,
        s.avatar_url,
        coalesce(sc.services_count, 0)::integer as services_count,
        coalesce(pc.professionals_count, 0)::integer as professionals_count,
        coalesce(sf.schedule_configured, false) as schedule_configured,
        (%1$s)::boolean as catalog_active,
        (
          (%1$s)
          and coalesce(sc.services_count, 0) > 0
          and coalesce(pc.professionals_count, 0) > 0
          and coalesce(sf.schedule_configured, false)
        )::boolean as can_book,
        array_remove(array[
          case when not (%1$s) then 'Catálogo não publicado' end,
          case when coalesce(sc.services_count, 0) = 0 then 'Sem serviços cadastrados' end,
          case when coalesce(pc.professionals_count, 0) = 0 then 'Sem profissionais cadastrados' end,
          case when not coalesce(sf.schedule_configured, false) then 'Agenda não configurada' end
        ], null)::text[] as missing_reasons
      from %5$s s
      left join service_counts sc on sc.shop_id = s.id
      left join professional_counts pc on pc.shop_id = s.id
      left join schedule_flags sf on sf.shop_id = s.id
      order by s.name
    $sql$,
    catalog_expr,
    neighborhood_expr,
    city_expr,
    state_expr,
    source_relation
  );
end;
$$;

create or replace function public.list_public_barbershops_with_status_filtered(
  p_city text default null,
  p_state text default null
)
returns table (
  id uuid,
  name text,
  slug text,
  address text,
  neighborhood text,
  city text,
  state text,
  avatar_url text,
  services_count integer,
  professionals_count integer,
  schedule_configured boolean,
  catalog_active boolean,
  can_book boolean,
  missing_reasons text[]
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.list_public_barbershops_with_status() s
  where (
    nullif(trim(p_city), '') is null
    or coalesce(s.city, '') ilike ('%' || trim(p_city) || '%')
  )
    and (
      nullif(trim(p_state), '') is null
      or upper(coalesce(s.state, '')) = upper(trim(p_state))
    )
  order by s.name;
$$;

revoke all on function public.list_public_barbershops_with_status() from public;
grant execute on function public.list_public_barbershops_with_status() to anon;
grant execute on function public.list_public_barbershops_with_status() to authenticated;

revoke all on function public.list_public_barbershops_with_status_filtered(text, text) from public;
grant execute on function public.list_public_barbershops_with_status_filtered(text, text) to anon;
grant execute on function public.list_public_barbershops_with_status_filtered(text, text) to authenticated;
