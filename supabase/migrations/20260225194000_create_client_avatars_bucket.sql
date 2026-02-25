-- create client avatar bucket + policies
begin;

alter table public.clients
  add column if not exists avatar_url text;

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

alter table public.clients enable row level security;

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

-- private bucket + authenticated read
-- path: {shop_id}/{client_id}/avatar.ext

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
