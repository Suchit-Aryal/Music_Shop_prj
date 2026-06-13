# Traditional Music Instruments — Storefront + Admin

A storefront for handcrafted Indian classical instruments (sitar, tabla, bansuri,
harmonium and more), with a cloud-backed **admin panel** for managing everything
the site shows — no coding required after setup.

The public site is plain static HTML/CSS/JS and talks directly to **Supabase**
(hosted Postgres + Auth + Storage). There is **no server to run** — host it
anywhere static, or run it locally.

## Features

**Storefront**
- Home page with a category carousel, a **Featured** grid, a **Suggested For You**
  row, and category sections (electronic, accessories, …).
- Browsable products page with category filters.
- Per-product detail pages with specs and a "Inquire via WhatsApp" button.

**Admin panel** (`/admin/`)
- Email + password login (Supabase Auth).
- **Listings** — add / edit / delete products, upload images, set price, stock,
  specifications and sort order.
- **Home page** — edit the hero and show / hide / reorder / rename the home sections.
- **Featured & Suggestions** — choose featured products and the ordered suggestions row.
- **Save / Discard workflow** — edits stay as a draft until you choose; a bar appears,
  each action asks for confirmation, and **Save** publishes to the live site instantly.

## Tech stack

- HTML, [Tailwind CSS](https://tailwindcss.com) (CDN), vanilla JavaScript
- [Supabase](https://supabase.com) — Postgres database, Auth, and Storage
- [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) (CDN)

## Project structure

```
.
├── index.html, products.html, product.html, contact.html   # public pages
├── admin/                      # admin panel (login + dashboard)
│   ├── index.html
│   ├── admin.css
│   └── admin.js
├── assets/
│   ├── css/                    # site styles
│   ├── images/                 # hero / product / ui images
│   └── js/
│       ├── config.js           # Supabase URL + anon key (public-safe)
│       ├── supabase-client.js  # shared Supabase client
│       ├── data-service.js     # public read layer (products + site config)
│       ├── home.js             # home page rendering
│       ├── product.js          # product detail page
│       └── whatsapp.js         # WhatsApp order popup
├── sql/                        # database setup (run in the Supabase SQL editor)
│   ├── 01_schema.sql           # products + site_config tables
│   ├── 02_rls.sql              # row-level security (public read, admin write)
│   ├── 03_storage.sql          # product-images storage bucket
│   ├── 04_seed.sql             # initial products
│   └── 05_admins.sql           # admin allowlist + is_admin()
├── data/products.json          # backup of the original seed data (not used at runtime)
├── SETUP.md                    # full setup walkthrough
└── docs/superpowers/           # design spec + implementation plan
```

## Getting started

See **[SETUP.md](SETUP.md)** for the full walkthrough. In short:

1. Create a Supabase project and copy its **Project URL** + **anon public** key into
   `assets/js/config.js`.
2. Run the SQL files in `sql/` (order: `01`, `05`, `02`, `03`, `04`) in the Supabase
   SQL editor.
3. Create an admin user in **Authentication → Users**, then add them to the `admins`
   table (snippet in `SETUP.md`).
4. Serve the folder:
   ```bash
   python3 -m http.server 8000
   ```
   - Store: <http://localhost:8000/>
   - Admin: <http://localhost:8000/admin/>

## Security notes

- The **anon key** in `config.js` is meant to be public. Database writes are blocked
  unless you are a logged-in admin (enforced by row-level security + the `admins`
  allowlist), so leaking the anon key does not let anyone modify the store.
- **Never** put the `service_role` / secret key or the database password in this
  repo or any frontend file.
