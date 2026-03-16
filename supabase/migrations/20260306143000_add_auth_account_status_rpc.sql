create or replace function public.get_auth_account_status(p_email text)
returns table (
  account_exists boolean,
  email_confirmed boolean
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_normalized_email = '' then
    return query select false, false;
    return;
  end if;

  return query
  with matched_user as (
    select email_confirmed_at
    from auth.users
    where lower(email) = v_normalized_email
    limit 1
  )
  select
    exists(select 1 from matched_user) as account_exists,
    coalesce((select email_confirmed_at is not null from matched_user), false) as email_confirmed;
end;
$$;

revoke all on function public.get_auth_account_status(text) from public;
grant execute on function public.get_auth_account_status(text) to anon, authenticated;

comment on function public.get_auth_account_status(text) is
  'Returns whether an auth account exists for the provided email and whether the email is confirmed.';
