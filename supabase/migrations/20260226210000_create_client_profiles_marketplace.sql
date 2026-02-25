-- Global client profile to support marketplace flow (no shop binding at signup)

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone text null,
  email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;

create index if not exists idx_client_profiles_user_id on public.client_profiles(user_id);

-- Keep updated_at in sync
create or replace function public.touch_client_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_client_profiles_updated_at on public.client_profiles;
create trigger trg_touch_client_profiles_updated_at
before update on public.client_profiles
for each row execute function public.touch_client_profiles_updated_at();

drop policy if exists "client_profiles_select_own" on public.client_profiles;
create policy "client_profiles_select_own"
on public.client_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "client_profiles_insert_own" on public.client_profiles;
create policy "client_profiles_insert_own"
on public.client_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "client_profiles_update_own" on public.client_profiles;
create policy "client_profiles_update_own"
on public.client_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

