-- Normalize marketplace location fields and guarantee `barbershops` public read shape.

do $$
begin
  if to_regclass('public.shops') is not null then
    execute $sql$
      update public.shops
      set
        city = nullif(regexp_replace(trim(coalesce(city, '')), '\s+', ' ', 'g'), ''),
        state = case
          when upper(trim(coalesce(state, ''))) ~ '^[A-Z]{2}$' then upper(trim(state))
          else null
        end,
        neighborhood = nullif(regexp_replace(trim(coalesce(neighborhood, '')), '\s+', ' ', 'g'), '')
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'barbershops'
      and table_type = 'BASE TABLE'
  ) then
    execute $sql$
      update public.barbershops
      set
        city = nullif(regexp_replace(trim(coalesce(city, '')), '\s+', ' ', 'g'), ''),
        state = case
          when upper(trim(coalesce(state, ''))) ~ '^[A-Z]{2}$' then upper(trim(state))
          else null
        end,
        neighborhood = nullif(regexp_replace(trim(coalesce(neighborhood, '')), '\s+', ' ', 'g'), '')
    $sql$;
  end if;
end;
$$;

-- If canonical source is shops, keep barbershops as an up-to-date compatibility view.
do $$
begin
  if to_regclass('public.shops') is not null then
    execute 'create or replace view public.barbershops as select * from public.shops';
  end if;
end;
$$;

-- Ensure marketplace read policy exists on shops.
do $$
begin
  if to_regclass('public.shops') is not null then
    execute 'alter table public.shops enable row level security';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'shops'
        and policyname = 'marketplace_shops_select'
    ) then
      execute 'create policy marketplace_shops_select on public.shops for select to anon, authenticated using (true)';
    end if;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.barbershops') is not null then
    execute 'grant select on public.barbershops to anon';
    execute 'grant select on public.barbershops to authenticated';
  end if;
end;
$$;

