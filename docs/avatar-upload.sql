-- Avatar upload (BarberAge) - Supabase SQL
-- Apply once in Supabase SQL Editor.

begin;

-- 1) Schema
alter table public.shops
  add column if not exists avatar_url text;

alter table public.clients
  add column if not exists avatar_url text;

-- 2) Buckets (private, 2MB, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-avatars',
  'shop-avatars',
  false,
  2097152,
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-avatars',
  'client-avatars',
  false,
  2097152,
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Table RLS updates (avatar_url)
alter table public.shops enable row level security;
alter table public.clients enable row level security;

drop policy if exists shops_update_avatar_by_member on public.shops;
create policy shops_update_avatar_by_member
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

drop policy if exists clients_update_own_avatar on public.clients;
create policy clients_update_own_avatar
on public.clients
for update
to authenticated
using (
  exists (
    select 1
    from public.client_users cu
    where cu.client_id = clients.id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.client_users cu
    where cu.client_id = clients.id
      and cu.user_id = auth.uid()
  )
);

-- 4) Storage RLS: shop-avatars
-- Path required by frontend:
--   avatars/{auth.uid()}/avatar-{timestamp}.png
-- Read model:
--   authenticated (private bucket, not public)

drop policy if exists shop_avatars_select_authenticated on storage.objects;
create policy shop_avatars_select_authenticated
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shop-avatars'
);

drop policy if exists shop_avatars_insert_own_folder on storage.objects;
create policy shop_avatars_insert_own_folder
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists shop_avatars_update_own_folder on storage.objects;
create policy shop_avatars_update_own_folder
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shop-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'shop-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists shop_avatars_delete_own_folder on storage.objects;
create policy shop_avatars_delete_own_folder
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shop-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- 5) Storage RLS: client-avatars (kept tenant-isolated)
-- Path:
--   {shop_id}/{client_id}/avatar.ext

drop policy if exists client_avatars_select on storage.objects;
create policy client_avatars_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-avatars'
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and (
    exists (
      select 1
      from public.shop_members sm
      where sm.user_id = auth.uid()
        and sm.shop_id::text = (storage.foldername(name))[1]
    )
    or exists (
      select 1
      from public.client_users cu
      where cu.user_id = auth.uid()
        and cu.shop_id::text = (storage.foldername(name))[1]
        and cu.client_id::text = (storage.foldername(name))[2]
    )
  )
);

drop policy if exists client_avatars_insert_own on storage.objects;
create policy client_avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.shop_id::text = (storage.foldername(name))[1]
      and cu.client_id::text = (storage.foldername(name))[2]
  )
);

drop policy if exists client_avatars_update_own on storage.objects;
create policy client_avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.shop_id::text = (storage.foldername(name))[1]
      and cu.client_id::text = (storage.foldername(name))[2]
  )
)
with check (
  bucket_id = 'client-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.shop_id::text = (storage.foldername(name))[1]
      and cu.client_id::text = (storage.foldername(name))[2]
  )
);

drop policy if exists client_avatars_delete_own on storage.objects;
create policy client_avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.shop_id::text = (storage.foldername(name))[1]
      and cu.client_id::text = (storage.foldername(name))[2]
  )
);

commit;
