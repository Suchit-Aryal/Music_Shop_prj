-- Row Level Security. Run after 01_schema.sql AND 05_admins.sql.
-- Public visitors can READ; only users in the admins allowlist can WRITE.

alter table products    enable row level security;
alter table site_config enable row level security;

-- Public read
drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products
  for select using (true);

drop policy if exists "site_config_public_read" on site_config;
create policy "site_config_public_read" on site_config
  for select using (true);

-- Admin-only write (insert / update / delete). Drops the older permissive
-- "authenticated" policies if they exist.
drop policy if exists "products_auth_write" on products;
drop policy if exists "products_admin_write" on products;
create policy "products_admin_write" on products
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "site_config_auth_write" on site_config;
drop policy if exists "site_config_admin_write" on site_config;
create policy "site_config_admin_write" on site_config
  for all
  using (public.is_admin())
  with check (public.is_admin());
