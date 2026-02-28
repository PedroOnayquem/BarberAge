-- Ensure location fields exist on shops and update policy allows shop members to edit own shop data.

alter table if exists public.shops
  add column if not exists cep text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table if exists public.shops
  drop constraint if exists shops_cep_format_check;

alter table if exists public.shops
  add constraint shops_cep_format_check
  check (cep is null or cep ~ '^[0-9]{8}$');

alter table if exists public.shops
  drop constraint if exists shops_state_format_check;

alter table if exists public.shops
  add constraint shops_state_format_check
  check (state is null or state ~ '^[A-Z]{2}$');

alter table if exists public.shops
  enable row level security;

drop policy if exists shops_update_by_member on public.shops;
create policy shops_update_by_member
on public.shops
for update
to authenticated
using (
  exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = shops.id
      and sm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = shops.id
      and sm.user_id = auth.uid()
  )
);

-- Keep compatibility table aligned if barbershops is a real table.
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
        add column if not exists complement text,
        add column if not exists neighborhood text,
        add column if not exists city text,
        add column if not exists state text,
        add column if not exists latitude double precision,
        add column if not exists longitude double precision
    $sql$;
  end if;
end;
$$;
