-- Normalize active flags and harden marketplace read policies.
-- Goal: all clients must consistently see active services/professionals across accounts.

alter table if exists public.services enable row level security;
alter table if exists public.professionals enable row level security;

alter table if exists public.services
  alter column active set default true;

alter table if exists public.professionals
  alter column active set default true;

update public.services
set active = true
where active is null;

update public.professionals
set active = true
where active is null;

do $$
begin
  begin
    execute 'alter table public.services alter column active set not null';
  exception
    when others then
      null;
  end;

  begin
    execute 'alter table public.professionals alter column active set not null';
  exception
    when others then
      null;
  end;
end;
$$;

do $$
declare
  rec record;
begin
  if to_regclass('public.services') is not null then
    for rec in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'services'
        and cmd = 'SELECT'
    loop
      execute format('drop policy if exists %I on public.services', rec.policyname);
    end loop;
  end if;

  if to_regclass('public.professionals') is not null then
    for rec in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'professionals'
        and cmd = 'SELECT'
    loop
      execute format('drop policy if exists %I on public.professionals', rec.policyname);
    end loop;
  end if;
end;
$$;

create policy marketplace_services_select
on public.services
for select
to anon, authenticated
using (
  coalesce(active, true) = true
  or public.is_shop_member(shop_id)
);

create policy marketplace_professionals_select
on public.professionals
for select
to anon, authenticated
using (
  coalesce(active, true) = true
  or public.is_shop_member(shop_id)
);

grant select on public.services to anon, authenticated;
grant select on public.professionals to anon, authenticated;
