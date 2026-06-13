-- Admin allowlist. Run after 01_schema.sql (before re-running 02_rls.sql).
-- Only users listed here can write. This is independent of the email sign-up
-- setting: even if someone self-registers, they cannot modify the store.

create table if not exists admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on, with NO policies: the table is only reachable through the
-- security-definer is_admin() function below, never directly via the API.
alter table admins enable row level security;

create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Add an admin (run once per admin, after creating the auth user):
--   insert into admins (user_id)
--   select id from auth.users where email = 'admin@musicshop.com'
--   on conflict (user_id) do nothing;
