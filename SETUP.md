# MusicShop — Setup Guide

This is the storefront + a cloud-backed admin panel. The public site reads its
products and home-page settings from **Supabase** (a hosted Postgres database
with auth and file storage). The admin panel lets you log in and change
everything, with a **Save / Discard** workflow.

There is **no server to run** — it's plain HTML/CSS/JS that talks to Supabase
directly. You can host it anywhere static (or run it locally).

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up / create a **new project**.
2. Wait for it to finish provisioning.
3. Open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key

## 2. Add your keys to the site

Open `assets/js/config.js` and paste your values:

```js
window.SUPABASE_CONFIG = {
  url: "https://abcdefgh.supabase.co",
  anonKey: "eyJ...your-anon-key...",
};
```

> The **anon key is safe to put here** — it's meant for the browser. Database
> writes are blocked unless you're logged in as the admin (enforced by the
> database rules in `sql/02_rls.sql`). **Never** paste the `service_role` key here.

## 3. Create the database

In the Supabase dashboard open **SQL Editor** and run these files **in order**
(open each, paste, Run):

1. `sql/01_schema.sql` — creates the `products` and `site_config` tables + default home layout
2. `sql/02_rls.sql` — security rules (public can read, only admin can write)
3. `sql/03_storage.sql` — creates the `product-images` storage bucket
4. `sql/04_seed.sql` — loads the initial products

## 4. Create your admin login

1. In Supabase, go to **Authentication → Providers → Email** and make sure Email
   is enabled. Turn **OFF** "Allow new users to sign up" (so only you can log in).
2. Go to **Authentication → Users → Add user → Create new user**.
3. Enter the email + password you want to log in with. (Tip: tick
   "Auto Confirm User" so you don't need an email confirmation.)

## 5. Run the site

From this folder:

```bash
python3 -m http.server 8000
```

Then open:

- Storefront: <http://localhost:8000/>
- Admin panel: <http://localhost:8000/admin/>

(Any static host works too — GitHub Pages, Netlify, Vercel, etc. Just upload the
contents of this folder.)

---

## Using the admin panel

Log in at `/admin/` with the email + password you created.

- **Listings** — add / edit / delete products, upload product images, set price,
  stock, specifications, and sort order.
- **Home page** — edit the hero text and the home sections (show/hide, rename,
  reorder, change how many items appear).
- **Featured & Suggestions** — choose which products appear in the Featured grid
  and the "Suggested For You" row (and order the suggestions).

### Save / Discard

Nothing you change is live until you **Save**. As soon as you edit something, a
bar appears at the bottom:

- **Save changes** → asks you to confirm, then writes to the cloud. Changes are
  immediately live on the public site (reload to see them).
- **Discard changes** → asks you to confirm, then throws away your unsaved edits.

---

## Notes

- `data/products.json` is kept only as a human-readable backup of the original
  product data. The live data now lives in Supabase; that file is no longer read
  by the site.
- The contact page is currently static (not yet editable from the admin).
