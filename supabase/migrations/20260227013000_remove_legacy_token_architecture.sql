-- Remove legacy token/code architecture for client-barbershop linking.
-- Marketplace flow uses public slug routes and appointment.shop_id linkage.

-- 1) Drop legacy token columns if they still exist in older environments.
alter table if exists public.shops
  drop column if exists token;

alter table if exists public.barbershops
  drop column if exists token;

-- 2) Drop legacy RPC/functions used by token join flows, if present.
drop function if exists public.validate_barbershop_token(text);
drop function if exists public.validate_barbershop_token(uuid);
drop function if exists public.validate_barbershop_token();

drop function if exists public.join_barbershop_by_token(text);
drop function if exists public.join_barbershop_by_token(uuid);
drop function if exists public.join_barbershop_by_token();

drop function if exists public.link_client_by_token(text);
drop function if exists public.link_client_by_token(uuid);
drop function if exists public.link_client_by_token();

