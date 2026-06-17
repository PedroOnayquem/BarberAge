-- Generic marketplace categories for local service providers.
-- Existing shops are linked to "Barbearia" to preserve the current catalog.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_format_check check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

create table if not exists public.shop_categories (
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, category_id)
);

create index if not exists shop_categories_category_id_idx on public.shop_categories(category_id);
create index if not exists categories_active_sort_idx on public.categories(active, sort_order, name);

insert into public.categories (slug, name, description, icon, sort_order)
values
  ('barbershop', 'Barbearia', 'Cabelo, barba e cuidados masculinos.', 'scissors', 10),
  ('manicure', 'Manicure', 'Unhas, esmaltação e cuidados com mãos e pés.', 'hand', 20),
  ('car_wash', 'Lava-jato', 'Lavagem, estética automotiva e higienização.', 'car', 30),
  ('aesthetics', 'Estética', 'Procedimentos estéticos, pele e bem-estar.', 'sparkles', 40),
  ('massage', 'Massagem', 'Massoterapia, relaxamento e terapias corporais.', 'heart-pulse', 50),
  ('pet_care', 'Cuidados pet', 'Banho, tosa e serviços para pets.', 'paw-print', 60)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into public.shop_categories (shop_id, category_id)
select s.id, c.id
from public.shops s
cross join public.categories c
where c.slug = 'barbershop'
on conflict do nothing;

alter table public.categories enable row level security;
alter table public.shop_categories enable row level security;

drop policy if exists categories_marketplace_select on public.categories;
create policy categories_marketplace_select
on public.categories
for select
to anon, authenticated
using (active = true);

drop policy if exists shop_categories_marketplace_select on public.shop_categories;
create policy shop_categories_marketplace_select
on public.shop_categories
for select
to anon, authenticated
using (true);

drop policy if exists shop_categories_member_insert on public.shop_categories;
create policy shop_categories_member_insert
on public.shop_categories
for insert
to authenticated
with check (public.is_shop_member(shop_id));

drop policy if exists shop_categories_member_delete on public.shop_categories;
create policy shop_categories_member_delete
on public.shop_categories
for delete
to authenticated
using (public.is_shop_member(shop_id));

grant select on public.categories to anon, authenticated;
grant select on public.shop_categories to anon, authenticated;
grant insert, delete on public.shop_categories to authenticated;

create or replace function public.list_public_service_businesses_with_status()
returns table (
  id uuid,
  name text,
  slug text,
  address text,
  neighborhood text,
  city text,
  state text,
  avatar_url text,
  category_slugs text[],
  category_names text[],
  service_names text[],
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
  with service_rollup as (
    select
      sv.shop_id,
      count(*)::integer as services_count,
      array_agg(sv.name order by sv.name)::text[] as service_names
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
  ),
  category_rollup as (
    select
      sc.shop_id,
      array_agg(c.slug order by c.sort_order, c.name)::text[] as category_slugs,
      array_agg(c.name order by c.sort_order, c.name)::text[] as category_names
    from public.shop_categories sc
    join public.categories c on c.id = sc.category_id
    where c.active = true
    group by sc.shop_id
  )
  select
    s.id,
    s.name,
    s.slug,
    s.address,
    s.neighborhood,
    s.city,
    s.state,
    s.avatar_url,
    coalesce(cr.category_slugs, array[]::text[]) as category_slugs,
    coalesce(cr.category_names, array[]::text[]) as category_names,
    coalesce(sr.service_names, array[]::text[]) as service_names,
    coalesce(sr.services_count, 0)::integer as services_count,
    coalesce(pc.professionals_count, 0)::integer as professionals_count,
    coalesce(sf.schedule_configured, false) as schedule_configured,
    true as catalog_active,
    (
      cardinality(coalesce(cr.category_slugs, array[]::text[])) > 0
      and coalesce(sr.services_count, 0) > 0
      and coalesce(pc.professionals_count, 0) > 0
      and coalesce(sf.schedule_configured, false)
    )::boolean as can_book,
    array_remove(array[
      case when cardinality(coalesce(cr.category_slugs, array[]::text[])) = 0 then 'Sem categoria cadastrada' end,
      case when coalesce(sr.services_count, 0) = 0 then 'Sem serviços cadastrados' end,
      case when coalesce(pc.professionals_count, 0) = 0 then 'Sem profissionais cadastrados' end,
      case when not coalesce(sf.schedule_configured, false) then 'Agenda não configurada' end
    ], null)::text[] as missing_reasons
  from public.shops s
  left join service_rollup sr on sr.shop_id = s.id
  left join professional_counts pc on pc.shop_id = s.id
  left join schedule_flags sf on sf.shop_id = s.id
  left join category_rollup cr on cr.shop_id = s.id
  order by s.name;
$$;

create or replace function public.list_public_service_businesses_with_status_filtered(
  p_search text default null,
  p_category_slug text default null,
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
  category_slugs text[],
  category_names text[],
  service_names text[],
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
  from public.list_public_service_businesses_with_status() s
  where (
    nullif(trim(p_search), '') is null
    or s.name ilike ('%' || trim(p_search) || '%')
    or coalesce(s.address, '') ilike ('%' || trim(p_search) || '%')
    or coalesce(s.neighborhood, '') ilike ('%' || trim(p_search) || '%')
    or coalesce(s.city, '') ilike ('%' || trim(p_search) || '%')
    or coalesce(s.state, '') ilike ('%' || trim(p_search) || '%')
    or array_to_string(s.category_names, ' ') ilike ('%' || trim(p_search) || '%')
    or array_to_string(s.service_names, ' ') ilike ('%' || trim(p_search) || '%')
  )
    and (
      nullif(trim(p_category_slug), '') is null
      or trim(p_category_slug) = any(s.category_slugs)
    )
    and (
      nullif(trim(p_city), '') is null
      or coalesce(s.city, '') ilike ('%' || trim(p_city) || '%')
    )
    and (
      nullif(trim(p_state), '') is null
      or upper(coalesce(s.state, '')) = upper(trim(p_state))
    )
  order by s.name;
$$;

revoke all on function public.list_public_service_businesses_with_status() from public;
grant execute on function public.list_public_service_businesses_with_status() to anon;
grant execute on function public.list_public_service_businesses_with_status() to authenticated;

revoke all on function public.list_public_service_businesses_with_status_filtered(text, text, text, text) from public;
grant execute on function public.list_public_service_businesses_with_status_filtered(text, text, text, text) to anon;
grant execute on function public.list_public_service_businesses_with_status_filtered(text, text, text, text) to authenticated;
