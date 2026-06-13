-- MusicShop schema. Run this first in the Supabase SQL editor.

create table if not exists products (
  id              text primary key,
  name            text not null,
  category        text not null default 'other',
  series          text,
  image_url       text,
  description     text,
  price           text,
  in_stock        boolean not null default true,
  whatsapp_number text,
  specs           jsonb not null default '{}'::jsonb,
  is_featured     boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists site_config (
  id            int primary key default 1,
  hero          jsonb not null default '{}'::jsonb,
  home_sections jsonb not null default '[]'::jsonb,
  suggestions   jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint site_config_singleton check (id = 1)
);

-- Default site configuration (mirrors the original hard-coded home layout).
insert into site_config (id, hero, home_sections, suggestions)
values (
  1,
  '{
    "title": "Traditional Music Instruments",
    "subtitle": "Handcrafted instruments for every musician",
    "image": "./assets/images/hero/sitar-hero.png",
    "ctaText": "Browse Instruments",
    "ctaLink": "products.html"
  }'::jsonb,
  '[
    {"key":"featured","title":"Featured Masterpieces","type":"featured","limit":8,"visible":true},
    {"key":"suggestions","title":"Suggested For You","type":"suggestions","limit":8,"visible":true},
    {"key":"electronic","title":"Electronic Instruments","type":"category","category":"electronic","limit":8,"visible":true},
    {"key":"accessories","title":"Essential Accessories","type":"category","category":"accessories","limit":15,"visible":true}
  ]'::jsonb,
  '[]'::jsonb
)
on conflict (id) do nothing;
