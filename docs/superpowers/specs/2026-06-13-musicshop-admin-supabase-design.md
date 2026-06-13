# MusicShop — Cloud-Backed Storefront + Admin Panel

**Date:** 2026-06-13
**Status:** Approved (contact-page editing and PHP version deferred to a later iteration)

## Goal

Turn the existing static MusicShop storefront (currently in `whatsapp_popup/`) into a
clean, deployable project living in `final output/`, backed by a **Supabase** cloud
database, with an **admin panel** that lets the owner log in and edit everything the
public site shows — product listings, the home page, the featured/suggestions spots,
and individual product pages — using a staged **Save / Discard** workflow with
confirmation prompts.

## Non-goals (v1)

- Editing the contact page content (left as static for now).
- The PHP version in `with php/` — retired; the live project is the static + Supabase site.
- Multi-admin roles / permissions. A single admin account is enough.

## Architecture overview

```
final output/
  index.html, products.html, product.html, contact.html   # public site
  assets/css, assets/images, assets/js
    assets/js/config.js          # Supabase URL + anon key (placeholders, git-ignored values)
    assets/js/supabase-client.js # creates the shared Supabase client
    assets/js/data-service.js    # fetch + cache products & site_config from Supabase
    assets/js/home.js            # home sections (reads data-service)
    assets/js/product.js         # product page (reads data-service)
    (products.html inline script)# listings grid (reads data-service)
    assets/js/whatsapp.js        # unchanged
  admin/
    index.html                   # login + dashboard shell
    admin.css
    admin.js                     # auth, draft state, save/discard, editors
  sql/
    01_schema.sql                # tables
    02_rls.sql                   # row-level security policies
    03_storage.sql               # product-images bucket + policies
    04_seed.sql                  # initial products migrated from products.json
  docs/superpowers/specs/...     # this spec
  .gitignore
```

No application server. The static files talk to Supabase directly via `@supabase/supabase-js`
(loaded from CDN). Supabase provides Postgres, Auth, REST, and Storage.

## Data model (Supabase / Postgres)

### `products`
| column | type | notes |
|---|---|---|
| id | text (PK) | slug, e.g. `classical-sitar` |
| name | text | |
| category | text | e.g. `string`, `electronic`, `accessories` |
| series | text | section grouping label |
| image_url | text | local path or Supabase Storage URL |
| description | text | |
| price | text | kept as display string, e.g. `Rs. 45,000` |
| in_stock | boolean | default true |
| whatsapp_number | text | |
| specs | jsonb | key/value map |
| is_featured | boolean | default false — manual featured flag |
| sort_order | int | display ordering |
| created_at | timestamptz | default now() |

### `site_config` (single row, id = 1)
| column | type | notes |
|---|---|---|
| id | int (PK) | always 1 |
| hero | jsonb | home hero content (title, subtitle, image, etc.) |
| home_sections | jsonb | ordered list of `{category, title, type, limit, visible}` |
| suggestions | jsonb | ordered list of product ids for the suggestions spot |
| updated_at | timestamptz | |

`home_sections` replaces the current hard-coded calls in `home.js`
(`featured`, `electronic`, `accessories`) so the owner can toggle/reorder them.
`featured` selection comes from `products.is_featured` (replacing the old
"price > 20000 random" heuristic).

## Security (RLS)

- `products`, `site_config`: **public SELECT** (anon read) so visitors see the site.
- `products`, `site_config`: **INSERT/UPDATE/DELETE only for `authenticated` role**.
- Storage `product-images` bucket: public read; write only for `authenticated`.
- The anon key is shipped in frontend JS — this is safe by design; writes are blocked
  by RLS. The service-role key is never used in the frontend and never committed.
- Public sign-up is disabled in Supabase Auth settings; the admin user is created
  manually in the Supabase dashboard.

## Public site behavior

- `data-service.js` fetches `products` and `site_config` once on load, caches in memory.
- `home.js` renders sections from `site_config.home_sections` + `products`.
- `products.html` renders the grid/filter from cached products.
- `product.js` renders a single product by `?id=` from cached products.
- If Supabase is unreachable, show a friendly "couldn't load products" message.

## Admin panel (`/admin/`)

### Auth
- Login form (email + password) → `supabase.auth.signInWithPassword`.
- Session persisted by supabase-js; on load, if no session → show login, else dashboard.
- Logout button.

### Dashboard sections
1. **Listings** — table of all products; add, edit, delete; image upload to Storage;
   in-stock toggle; specs key/value editor; sort order.
2. **Home page** — edit hero fields; toggle/reorder `home_sections`.
3. **Featured / Suggestions** — pick which products are featured (`is_featured`) and
   choose/order the suggestions product ids.
4. **Product editor** — full single-product edit form (same fields as Listings row).

### Save / Discard workflow (core requirement)
- All edits mutate an in-memory **draft** copy of the data; nothing is written to
  Supabase immediately.
- When the draft differs from the last-saved state, a sticky action bar appears with
  **"Save changes"** and **"Discard changes"**.
- Clicking either button opens a **confirmation dialog** ("Are you sure you want to
  continue?") before acting.
- **Save** → writes the draft to Supabase (upserts/deletes as needed) → on success the
  public site reflects changes immediately → draft becomes the new saved baseline.
- **Discard** → reverts the draft to the last-saved baseline; action bar disappears.

## Git / GitHub

- `final output/` becomes the tracked project root.
- Reuse the existing remote `https://github.com/Suchit-Aryal/Music_Shop_prj.git`.
- Replace the repo contents with the clean project (fresh history, force-push) — the
  earlier accidental `whatsapp_popup` push is superseded.
- `.gitignore` excludes any local secret/env files. The committed `config.js` contains
  only the public anon key + project URL (or placeholders the owner fills in).
- The force-push to the remote is confirmed with the owner before running (it rewrites
  remote history).

## Setup the owner performs (documented in admin/README or a SETUP.md)

1. Create a Supabase project; copy Project URL + anon key into `assets/js/config.js`.
2. Run `sql/01..04` in the Supabase SQL editor.
3. Create the `product-images` Storage bucket (or via `03_storage.sql`).
4. Disable public sign-up; create the admin user (email + password) in Auth.
5. Open the site / admin (any static host or `python3 -m http.server`).

## Testing / verification

- Public site loads products from Supabase and renders home, listings, product pages.
- Admin login rejects bad credentials, accepts the admin user.
- Editing → Save persists to Supabase and shows on the public site after reload.
- Editing → Discard reverts with no DB write.
- RLS verified: anon cannot write (attempted write fails).
