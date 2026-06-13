-- Row Level Security. Run after 01_schema.sql.
-- Public visitors can READ; only a logged-in (authenticated) admin can WRITE.

alter table products    enable row level security;
alter table site_config enable row level security;

-- Public read
drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products
  for select using (true);

drop policy if exists "site_config_public_read" on site_config;
create policy "site_config_public_read" on site_config
  for select using (true);

-- Authenticated write (insert / update / delete)
drop policy if exists "products_auth_write" on products;
create policy "products_auth_write" on products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "site_config_auth_write" on site_config;
create policy "site_config_auth_write" on site_config
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
