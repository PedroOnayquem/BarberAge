-- Add shop coordinates and geocoding cache used by Edge Function.

alter table if exists public.shops
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

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
        add column if not exists latitude double precision,
        add column if not exists longitude double precision
    $sql$;
  end if;
end;
$$;

alter table if exists public.shops enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'marketplace_shops_select'
  ) then
    create policy marketplace_shops_select
    on public.shops
    for select
    to anon, authenticated
    using (true);
  end if;
end;
$$;

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
        and policyname = 'marketplace_barbershops_select'
    ) then
      execute 'create policy marketplace_barbershops_select on public.barbershops for select to anon, authenticated using (true)';
    end if;
  end if;
end;
$$;

create table if not exists public.geocode_cache (
  query_hash text primary key,
  query_text text not null,
  latitude double precision not null,
  longitude double precision not null,
  provider text not null default 'nominatim',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_geocode_cache_updated_at on public.geocode_cache (updated_at desc);

alter table if exists public.geocode_cache disable row level security;
