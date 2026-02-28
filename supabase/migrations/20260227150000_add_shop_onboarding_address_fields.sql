-- Add structured address fields used by shop onboarding and guarantee insert policy for authenticated users.

alter table if exists public.shops
  add column if not exists cep text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists complement text;

alter table if exists public.shops
  drop constraint if exists shops_cep_format_check;

alter table if exists public.shops
  add constraint shops_cep_format_check
  check (cep is null or cep ~ '^[0-9]{8}$');

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
        add column if not exists cep text,
        add column if not exists address_street text,
        add column if not exists address_number text,
        add column if not exists complement text
    $sql$;

    execute 'alter table public.barbershops drop constraint if exists barbershops_cep_format_check';
    execute 'alter table public.barbershops add constraint barbershops_cep_format_check check (cep is null or cep ~ ''^[0-9]{8}$'')';
  end if;
end;
$$;

alter table if exists public.shops enable row level security;

drop policy if exists shops_insert_authenticated_onboarding on public.shops;
create policy shops_insert_authenticated_onboarding
on public.shops
for insert
to authenticated
with check (auth.uid() is not null);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'barbershops'
      and table_type = 'BASE TABLE'
  ) then
    execute 'alter table public.barbershops enable row level security';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'barbershops'
        and policyname = 'barbershops_insert_authenticated_onboarding'
    ) then
      execute 'create policy barbershops_insert_authenticated_onboarding on public.barbershops for insert to authenticated with check (auth.uid() is not null)';
    end if;
  end if;
end;
$$;
