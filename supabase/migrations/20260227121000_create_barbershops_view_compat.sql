-- Create compatibility relation `public.barbershops` when canonical table is `public.shops`.
-- This allows frontend calls to use `barbershops` consistently.

do $$
begin
  if to_regclass('public.barbershops') is null and to_regclass('public.shops') is not null then
    execute 'create view public.barbershops as select * from public.shops';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.barbershops') is not null then
    execute 'grant select on public.barbershops to anon';
    execute 'grant select, insert, update, delete on public.barbershops to authenticated';
  end if;
end;
$$;

