alter table if exists public.shops
  add column if not exists shop_type text;

alter table if exists public.shops
  drop constraint if exists shops_shop_type_check;

alter table if exists public.shops
  add constraint shops_shop_type_check
  check (
    shop_type is null
    or shop_type in ('traditional', 'modern', 'studio', 'premium', 'multi_unit')
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
    execute 'alter table public.barbershops add column if not exists shop_type text';
    execute 'alter table public.barbershops drop constraint if exists barbershops_shop_type_check';
    execute '
      alter table public.barbershops
      add constraint barbershops_shop_type_check
      check (
        shop_type is null
        or shop_type in (''traditional'', ''modern'', ''studio'', ''premium'', ''multi_unit'')
      )
    ';
  end if;
end $$;
