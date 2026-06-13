# MusicShop Admin + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static MusicShop storefront into a clean `final output/` project backed by Supabase (DB + Auth + Storage), with an admin panel that edits all site content via a staged Save/Discard workflow.

**Architecture:** Static HTML/CSS/JS served as-is; `@supabase/supabase-js` (CDN) talks directly to Supabase. A shared `data-service.js` reads products + site_config for the public pages. The admin panel authenticates via Supabase Auth, edits an in-memory draft, and writes to Supabase on confirmed Save. RLS makes the public anon key safe.

**Tech Stack:** HTML, Tailwind (CDN, already used), vanilla JS, Supabase (Postgres, Auth, Storage), supabase-js v2 via CDN.

> **Test approach:** No JS test framework exists in this static project. Each task's "test" step is a concrete browser or SQL verification. Commit after each task.

---

### Task 1: Scaffolding, config, supabase client, .gitignore

**Files:**
- Create: `final output/.gitignore`
- Create: `final output/assets/js/config.js`
- Create: `final output/assets/js/supabase-client.js`
- Create: `final output/SETUP.md` (stub; filled in Task 10)

- [ ] **Step 1: `.gitignore`**

```
# OS / editor
.DS_Store
*.swp
# local secrets (config.js holds only the PUBLIC anon key; real secrets never live here)
*.env
.env*
config.local.js
node_modules/
```

- [ ] **Step 2: `config.js`** — public config, placeholders the owner fills.

```js
// Public Supabase config. The anon key is safe to ship in frontend code;
// database writes are blocked by Row Level Security. NEVER put the service_role key here.
window.SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_PROJECT_URL",   // e.g. https://abcd.supabase.co
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

- [ ] **Step 3: `supabase-client.js`** — creates the shared client (expects supabase-js loaded via CDN before it).

```js
// Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> then config.js
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const configured = cfg.url && cfg.anonKey && !cfg.url.startsWith("YOUR_");
  window.SUPABASE_CONFIGURED = configured;
  window.supabaseClient = configured
    ? window.supabase.createClient(cfg.url, cfg.anonKey)
    : null;
})();
```

- [ ] **Step 4: Verify** — open a scratch page / console: with placeholders, `window.SUPABASE_CONFIGURED === false` and no crash.

- [ ] **Step 5: Commit** `feat: scaffolding, supabase client + public config`

---

### Task 2: Supabase SQL (schema, RLS, storage, seed)

**Files:**
- Create: `final output/sql/01_schema.sql`
- Create: `final output/sql/02_rls.sql`
- Create: `final output/sql/03_storage.sql`
- Create: `final output/sql/04_seed.sql` (generated from `data/products.json`)

- [ ] **Step 1: `01_schema.sql`**

```sql
create table if not exists products (
  id text primary key,
  name text not null,
  category text not null default 'other',
  series text,
  image_url text,
  description text,
  price text,
  in_stock boolean not null default true,
  whatsapp_number text,
  specs jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists site_config (
  id int primary key default 1,
  hero jsonb not null default '{}'::jsonb,
  home_sections jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint site_config_singleton check (id = 1)
);

insert into site_config (id, hero, home_sections, suggestions)
values (1, '{}'::jsonb,
  '[{"key":"featured","title":"Featured Instruments","type":"featured","limit":8,"visible":true},
    {"key":"electronic","title":"Electronics","type":"category","category":"electronic","limit":8,"visible":true},
    {"key":"accessories","title":"Accessories","type":"category","category":"accessories","limit":15,"visible":true}]'::jsonb,
  '[]'::jsonb)
on conflict (id) do nothing;
```

- [ ] **Step 2: `02_rls.sql`**

```sql
alter table products enable row level security;
alter table site_config enable row level security;

-- public read
create policy "products_public_read" on products for select using (true);
create policy "site_config_public_read" on site_config for select using (true);

-- authenticated write
create policy "products_auth_write" on products for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "site_config_auth_write" on site_config for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

- [ ] **Step 3: `03_storage.sql`**

```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_auth_write" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "product_images_auth_update" on storage.objects for update
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "product_images_auth_delete" on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
```

- [ ] **Step 4: Generate `04_seed.sql`** from `data/products.json` with a throwaway Node/Python one-liner that emits `insert into products (...) values (...) on conflict (id) do update set ...` for each product, mapping `image`→`image_url`, keeping `price` string, `specs`→jsonb, `series`→series, `category`→category, `is_featured`= (numeric price > 20000) as a sensible default, `sort_order`=index.

- [ ] **Step 5: Verify** — SQL files are valid (paste-ready). Confirm seed row count == products.json count.

- [ ] **Step 6: Commit** `feat: supabase schema, RLS, storage, seed SQL`

---

### Task 3: Public data service

**Files:**
- Create: `final output/assets/js/data-service.js`

- [ ] **Step 1: Implement** — single fetch+cache module exposing a stable API used by all public pages.

```js
// Public read layer. Caches products + site_config in memory for the page lifetime.
window.DataService = (function () {
  let _cache = null;
  async function load() {
    if (_cache) return _cache;
    if (!window.SUPABASE_CONFIGURED) throw new Error("Supabase not configured");
    const sb = window.supabaseClient;
    const [{ data: products, error: pErr }, { data: cfg, error: cErr }] = await Promise.all([
      sb.from("products").select("*").order("sort_order", { ascending: true }),
      sb.from("site_config").select("*").eq("id", 1).single(),
    ]);
    if (pErr) throw pErr;
    if (cErr) throw cErr;
    _cache = { products: products || [], config: cfg || {} };
    return _cache;
  }
  return {
    load,
    async getProducts() { return (await load()).products; },
    async getConfig() { return (await load()).config; },
    async getProduct(id) { return (await load()).products.find((p) => p.id === id) || null; },
  };
})();
```

- [ ] **Step 2: Verify** — against a configured project, `DataService.getProducts()` returns seeded rows.

- [ ] **Step 3: Commit** `feat: public data-service over supabase`

---

### Task 4: Wire public pages to data-service

**Files:**
- Modify: `final output/index.html` (remove stray `cd ...` line; add supabase CDN + config + client + data-service scripts; remove `products_data.js`)
- Modify: `final output/assets/js/home.js` (read from DataService; sections from `config.home_sections`; featured from `is_featured`; map `image_url`)
- Modify: `final output/assets/js/product.js` (use `DataService.getProduct`; `image_url`, `whatsapp_number`, `in_stock`)
- Modify: `final output/products.html` (inline script reads DataService; remove `products_data.js` + json fetch)
- Modify: `final output/contact.html` (swap scripts only if it referenced products_data.js)
- Delete: `final output/assets/js/products_data.js`, `final output/data/products.json` (no longer the source of truth) — keep a copy note in SETUP.

- [ ] **Step 1:** Add to each public page `<head>`/before page script:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/config.js"></script>
<script src="assets/js/supabase-client.js"></script>
<script src="assets/js/data-service.js"></script>
```
- [ ] **Step 2:** Rewrite `home.js` `DOMContentLoaded` to `await DataService.load()`, then render sections by iterating `config.home_sections` (visible only), using `is_featured` for the featured section and `category` match otherwise. Update `createCardHtml` to use `product.image_url`.
- [ ] **Step 3:** Update `product.js` to call `await DataService.getProduct(id)` and use `image_url`, `whatsapp_number`, `in_stock`.
- [ ] **Step 4:** Update `products.html` grid script similarly. Add a graceful error banner if load fails.
- [ ] **Step 5: Verify** — run `python3 -m http.server` in `final output/`, load each page against a configured Supabase; products render; product page resolves by id; offline shows friendly message.
- [ ] **Step 6: Commit** `feat: public site reads from supabase via data-service`

---

### Task 5: Admin shell + auth

**Files:**
- Create: `final output/admin/index.html`
- Create: `final output/admin/admin.css`
- Create: `final output/admin/admin.js`

- [ ] **Step 1:** `admin/index.html` loads supabase CDN, `../assets/js/config.js`, a local admin client init, and `admin.js`. Two views: `#login-view` (email, password, submit, error area) and `#dashboard-view` (hidden until authed) with a left nav: Listings / Home page / Featured & Suggestions, a top bar with Logout, and a `#save-bar` sticky bar (hidden by default).
- [ ] **Step 2:** `admin.js` auth flow:
```js
const sb = window.supabaseClient; // must be configured
async function refreshAuth() {
  const { data: { session } } = await sb.auth.getSession();
  showView(session ? "dashboard" : "login");
  if (session) await initDashboard();
}
loginForm.onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) showLoginError(error.message); else refreshAuth();
};
logoutBtn.onclick = async () => { await sb.auth.signOut(); refreshAuth(); };
```
- [ ] **Step 3: Verify** — bad creds show error; correct admin user logs in and reveals dashboard; logout returns to login; refresh keeps session.
- [ ] **Step 4: Commit** `feat: admin shell + supabase auth login/logout`

---

### Task 6: Draft state + Save/Discard bar + confirm dialog (CORE)

**Files:**
- Modify: `final output/admin/admin.js`
- Modify: `final output/admin/index.html` (confirm modal markup)

- [ ] **Step 1:** Draft store: on dashboard init, deep-clone loaded `{products, config}` into `saved` and `draft`. All editors mutate `draft` and call `markDirty()`.
```js
let saved = null, draft = null;
function snapshot(o){ return structuredClone(o); }
function isDirty(){ return JSON.stringify(saved) !== JSON.stringify(draft); }
function markDirty(){ document.getElementById('save-bar').classList.toggle('hidden', !isDirty()); rerenderActive(); }
```
- [ ] **Step 2:** Confirm modal: generic `confirmDialog(message)` returning a Promise<boolean>; "Are you sure you want to continue?" with Continue / Cancel.
- [ ] **Step 3:** Save: on click → `confirmDialog` → if yes, diff `draft.products` vs `saved.products` → upsert changed/new rows, delete removed ids, upsert `site_config` (id=1). On success: `saved = snapshot(draft)`, hide bar, toast "Saved — live on the site." On error: toast error, keep draft.
```js
async function saveAll(){
  if(!await confirmDialog("Save changes? This updates the live website.")) return;
  const sb = window.supabaseClient;
  const delIds = saved.products.filter(p=>!draft.products.find(d=>d.id===p.id)).map(p=>p.id);
  if(delIds.length){ const {error}=await sb.from('products').delete().in('id',delIds); if(error) return toast(error.message,true); }
  const { error: upErr } = await sb.from('products').upsert(draft.products); if(upErr) return toast(upErr.message,true);
  const { error: cErr } = await sb.from('site_config').upsert({ ...draft.config, id:1, updated_at:new Date().toISOString() }); if(cErr) return toast(cErr.message,true);
  saved = snapshot(draft); markDirty(); toast("Saved — live on the site.");
}
```
- [ ] **Step 4:** Discard: on click → `confirmDialog("Discard all unsaved changes?")` → if yes `draft = snapshot(saved); markDirty(); rerenderActive();`.
- [ ] **Step 5:** Warn on tab close while dirty: `window.onbeforeunload = () => isDirty() ? "" : undefined;`
- [ ] **Step 6: Verify** — edit a field → bar appears; Discard → confirm → reverts, bar hides; Save → confirm → DB updated (check public site after reload).
- [ ] **Step 7: Commit** `feat: admin draft state with confirmed save/discard`

---

### Task 7: Listings editor (CRUD + image upload + specs)

**Files:**
- Modify: `final output/admin/admin.js`

- [ ] **Step 1:** Render a products table (name, category, price, in-stock, featured, actions Edit/Delete) from `draft.products`.
- [ ] **Step 2:** Edit/Add opens a form (modal/panel) with all fields incl. `series`, `sort_order`, `whatsapp_number`, an in-stock toggle, a featured toggle, and a specs key/value editor (add/remove rows → `specs` object). On submit, mutate `draft.products` and `markDirty()` — does NOT hit DB (only Save does).
- [ ] **Step 3:** Image: file input → upload to Storage bucket `product-images` immediately (uploads are fine pre-save; they're just files), set `image_url` to public URL. Show preview. Also allow pasting a URL / keeping existing local path.
```js
async function uploadImage(file, id){
  const path = `${id}/${Date.now()}-${file.name}`;
  const { error } = await window.supabaseClient.storage.from('product-images').upload(path, file, { upsert:true });
  if(error) throw error;
  return window.supabaseClient.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
```
- [ ] **Step 4:** Delete removes from `draft.products` and `markDirty()` (actual DB delete on Save).
- [ ] **Step 5: Verify** — add/edit/delete reflected in draft + bar; image upload returns a working URL; Save persists; public listings update after reload.
- [ ] **Step 6: Commit** `feat: admin listings CRUD with image upload + specs editor`

---

### Task 8: Home page editor (hero + sections)

**Files:**
- Modify: `final output/admin/admin.js`

- [ ] **Step 1:** Hero form bound to `draft.config.hero` (title, subtitle, image_url, cta text/link as used by index.html). Map index.html hero markup to these fields.
- [ ] **Step 2:** Sections editor: list `draft.config.home_sections` with per-row visible toggle, title edit, limit, and up/down reorder; mutate array + `markDirty()`.
- [ ] **Step 3: Verify** — toggle/reorder a section, Save, reload home → order/visibility reflect changes.
- [ ] **Step 4: Commit** `feat: admin home page hero + sections editor`

---

### Task 9: Featured & Suggestions editor

**Files:**
- Modify: `final output/admin/admin.js`
- Modify: `final output/assets/js/home.js` + `final output/index.html` (render a suggestions section from `config.suggestions` if present)

- [ ] **Step 1:** Featured: checklist of products toggling `is_featured` in `draft.products`.
- [ ] **Step 2:** Suggestions: multi-select / ordered list writing product ids into `draft.config.suggestions`.
- [ ] **Step 3:** Public: `home.js` renders a "Suggestions" section from `config.suggestions` (ordered product lookup) when non-empty.
- [ ] **Step 4: Verify** — set featured + suggestions, Save, reload home → featured grid and suggestions reflect picks.
- [ ] **Step 5: Commit** `feat: featured + suggestions management`

---

### Task 10: SETUP.md + admin README

**Files:**
- Modify: `final output/SETUP.md`

- [ ] **Step 1:** Write step-by-step owner setup: create Supabase project; copy URL+anon key into `assets/js/config.js`; run `sql/01..04` in SQL editor; confirm Storage bucket; disable public sign-up + create admin user in Auth; run site via `python3 -m http.server` or any static host; open `/admin/` to log in. Note that the old `data/products.json` was the seed source.
- [ ] **Step 2: Commit** `docs: owner setup guide`

---

### Task 11: Git — make `final output/` the repo, reuse remote

**Files:** repo metadata only.

- [ ] **Step 1:** `cd "final output" && git init && git add -A && git commit -m "feat: cloud-backed MusicShop storefront + admin panel"` (include the Co-Authored-By trailer).
- [ ] **Step 2:** `git branch -M main && git remote add origin https://github.com/Suchit-Aryal/Music_Shop_prj.git`
- [ ] **Step 3:** Show the user the force-push command and CONFIRM before running (rewrites remote history): `git push -f origin main`.
- [ ] **Step 4: Verify** — `git status` clean; remote configured; (push only after user confirmation + auth).

---

## Self-Review

- **Spec coverage:** folder+clean copy (Task 1,4 + already done), Supabase backend (2), public reads (3,4), admin auth (5), save/discard+confirm (6), listings (7), home (8), featured/suggestions (9), git reuse-repo (11), setup docs (10). All spec sections covered.
- **Placeholder scan:** `config.js` placeholders are intentional (owner secrets), documented. No TODO/“handle later” steps.
- **Type consistency:** column names (`image_url`, `in_stock`, `whatsapp_number`, `is_featured`, `sort_order`, `specs`) used consistently across SQL, data-service, public pages, and admin. `DataService` API (`load/getProducts/getConfig/getProduct`) consistent. Draft API (`saved/draft/snapshot/isDirty/markDirty/saveAll/confirmDialog`) consistent across tasks 6–9.
