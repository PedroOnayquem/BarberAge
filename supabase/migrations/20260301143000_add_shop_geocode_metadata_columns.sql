-- Add geocoding metadata fields for precise destination routing.

alter table if exists public.shops
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_precision text,
  add column if not exists geocode_provider text,
  add column if not exists formatted_address text;

alter table if exists public.shops
  drop constraint if exists shops_geocode_precision_check;

alter table if exists public.shops
  add constraint shops_geocode_precision_check
  check (
    geocode_precision is null
    or geocode_precision in ('rooftop', 'street', 'postal_code', 'city')
  );

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
        add column if not exists geocoded_at timestamptz,
        add column if not exists geocode_precision text,
        add column if not exists geocode_provider text,
        add column if not exists formatted_address text
    $sql$;

    execute 'alter table public.barbershops drop constraint if exists barbershops_geocode_precision_check';
    execute $sql$
      alter table public.barbershops
        add constraint barbershops_geocode_precision_check
        check (
          geocode_precision is null
          or geocode_precision in ('rooftop', 'street', 'postal_code', 'city')
        )
    $sql$;
  end if;
end;
$$;

alter table if exists public.geocode_cache
  add column if not exists geocode_precision text,
  add column if not exists formatted_address text;
