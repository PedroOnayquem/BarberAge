-- Marketplace public catalog read policies.
-- Goal: allow client/public flows to list shops, active services and active professionals.
-- Safe/idempotent migration.

alter table public.shops enable row level security;
alter table public.services enable row level security;
alter table public.professionals enable row level security;

drop policy if exists marketplace_shops_select on public.shops;
create policy marketplace_shops_select
on public.shops
for select
to anon, authenticated
using (true);

drop policy if exists marketplace_services_select on public.services;
create policy marketplace_services_select
on public.services
for select
to anon, authenticated
using (active = true or public.is_shop_member(shop_id));

drop policy if exists marketplace_professionals_select on public.professionals;
create policy marketplace_professionals_select
on public.professionals
for select
to anon, authenticated
using (active = true or public.is_shop_member(shop_id));

