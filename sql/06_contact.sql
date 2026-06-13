-- Adds editable contact-page content to site_config. Run after 01_schema.sql.

alter table site_config
  add column if not exists contact jsonb not null default '{}'::jsonb;

-- Seed the contact block with the site's current details (only if still empty).
update site_config
set contact = '{
  "eyebrow": "GET IN TOUCH",
  "headline": "Let''s Talk Music",
  "intro": "Have questions? Want to schedule a visit? We''re here to help you find your perfect instrument.",
  "phone": "+977 9761800954",
  "whatsapp_number": "9779761800954",
  "email": "info@traditionalmusic.com",
  "address": "123 Music Street\nThamel, Kathmandu\nNepal",
  "hours_weekday": "Sunday - Friday: 10:00 AM - 7:00 PM",
  "hours_saturday": "Saturday: 10:00 AM - 5:00 PM",
  "instagram_url": "#",
  "facebook_url": "#"
}'::jsonb
where id = 1 and (contact is null or contact = '{}'::jsonb);
