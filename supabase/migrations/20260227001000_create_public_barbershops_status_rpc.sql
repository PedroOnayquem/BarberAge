-- Public marketplace status RPC
-- Returns one row per shop with aggregated catalog status.

create or replace function public.list_public_barbershops_with_status()
returns table (
  id uuid,
  name text,
  slug text,
  address text,
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
  catalog_expr text := 'true';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'catalog_active'
  ) then
    catalog_expr := 'coalesce(s.catalog_active, true)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'published'
  ) then
    catalog_expr := 'coalesce(s.published, true)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'is_active'
  ) then
    catalog_expr := 'coalesce(s.is_active, true)';
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
      from public.shops s
      left join service_counts sc on sc.shop_id = s.id
      left join professional_counts pc on pc.shop_id = s.id
      left join schedule_flags sf on sf.shop_id = s.id
      order by s.name
    $sql$,
    catalog_expr
  );
end;
$$;

revoke all on function public.list_public_barbershops_with_status() from public;
grant execute on function public.list_public_barbershops_with_status() to anon;
grant execute on function public.list_public_barbershops_with_status() to authenticated;

