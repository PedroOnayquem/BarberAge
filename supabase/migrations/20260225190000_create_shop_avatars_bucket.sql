-- create shop avatar bucket + policies
begin;

alter table public.shops
  add column if not exists avatar_url text;

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

alter table public.shops enable row level security;

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

-- private bucket + authenticated read (frontend usa signed URL)
drop policy if exists shop_avatars_select_authenticated on storage.objects;
create policy shop_avatars_select_authenticated
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shop-avatars'
);

-- somente dono autenticado pode escrever na propria pasta
-- path: avatars/{auth.uid()}/avatar-{timestamp}.png
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

commit;
