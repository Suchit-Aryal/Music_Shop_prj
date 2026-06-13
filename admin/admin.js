// MusicShop admin panel.
// - Auth via Supabase Auth (email + password)
// - Loads products + site_config into an in-memory DRAFT
// - All edits mutate the draft only; nothing hits the cloud until "Save changes"
// - Save / Discard each require confirmation, then Save writes to Supabase (live)
(function () {
  "use strict";

  const sb = window.supabaseClient;

  // ---- element refs ----
  const $ = (id) => document.getElementById(id);
  const loginView = $("login-view");
  const dashboardView = $("dashboard-view");
  const loginForm = $("login-form");
  const loginEmail = $("login-email");
  const loginPassword = $("login-password");
  const loginSubmit = $("login-submit");
  const loginError = $("login-error");
  const userEmail = $("user-email");
  const logoutBtn = $("logout-btn");
  const saveBar = $("save-bar");
  const saveBtn = $("save-btn");
  const discardBtn = $("discard-btn");
  const confirmModal = $("confirm-modal");
  const confirmMessage = $("confirm-message");
  const confirmOk = $("confirm-ok");
  const confirmCancel = $("confirm-cancel");
  const productModal = $("product-modal");
  const productForm = $("product-form");
  const toastEl = $("toast");
  const panels = {
    listings: $("panel-listings"),
    home: $("panel-home"),
    featured: $("panel-featured"),
    contact: $("panel-contact"),
  };

  // ---- state ----
  let saved = null; // last-saved baseline
  let draft = null; // working copy
  let activeView = "listings";
  let editingId = null; // product id currently open in modal (null = new)

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // ===================================================================== boot
  document.addEventListener("DOMContentLoaded", boot);

  async function boot() {
    if (!window.SUPABASE_CONFIGURED || !sb) {
      $("config-warning").classList.remove("hidden");
      showView("login");
      loginSubmit.disabled = true;
      loginError.textContent = "Configure Supabase first (see SETUP.md).";
      loginError.classList.remove("hidden");
      return;
    }
    wireHandlers();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (session) await enterDashboard(session);
    else showView("login");
  }

  function showView(name) {
    loginView.classList.toggle("hidden", name !== "login");
    dashboardView.classList.toggle("hidden", name !== "dashboard");
  }

  // ============================================================== auth wiring
  function wireHandlers() {
    loginForm.addEventListener("submit", onLogin);
    logoutBtn.addEventListener("click", onLogout);
    saveBtn.addEventListener("click", saveAll);
    discardBtn.addEventListener("click", discardAll);

    document.querySelectorAll(".nav-btn").forEach((btn) =>
      btn.addEventListener("click", () => setActive(btn.dataset.view))
    );

    // Product modal static handlers
    productForm.addEventListener("submit", applyProduct);
    $("pf-cancel").addEventListener("click", closeProductModal);
    $("pf-add-spec").addEventListener("click", () => addSpecRow("", ""));
    $("pf-image-url").addEventListener("input", (e) => {
      $("pf-image-preview").src = e.target.value || "";
    });
    $("pf-image-file").addEventListener("change", onImageFile);

    // Delegated handlers for dynamically rendered controls
    document.addEventListener("click", onDelegatedClick);
    document.addEventListener("input", onDelegatedInput);
    document.addEventListener("change", onDelegatedChange);

    window.addEventListener("beforeunload", (e) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  async function onLogin(e) {
    e.preventDefault();
    loginError.classList.add("hidden");
    loginSubmit.disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    });
    loginSubmit.disabled = false;
    if (error) {
      loginError.textContent = error.message;
      loginError.classList.remove("hidden");
      return;
    }
    await enterDashboard(data.session);
  }

  async function onLogout() {
    if (isDirty()) {
      const ok = await confirmDialog(
        "You have unsaved changes. Log out and lose them?"
      );
      if (!ok) return;
    }
    await sb.auth.signOut();
    saved = draft = null;
    showView("login");
    loginForm.reset();
  }

  async function enterDashboard(session) {
    showView("dashboard");
    userEmail.textContent = session.user.email || "";
    await loadData();
    setActive("listings");
  }

  // ============================================================== data layer
  function normalizeConfig(cfg) {
    cfg = cfg || {};
    return {
      hero: cfg.hero || {},
      home_sections: Array.isArray(cfg.home_sections) ? cfg.home_sections : [],
      suggestions: Array.isArray(cfg.suggestions) ? cfg.suggestions : [],
      contact: cfg.contact || {},
    };
  }

  async function loadData() {
    const [pRes, cRes] = await Promise.all([
      sb.from("products").select("*").order("sort_order", { ascending: true }),
      sb.from("site_config").select("*").eq("id", 1).single(),
    ]);
    if (pRes.error) toast(pRes.error.message, true);
    if (cRes.error) toast(cRes.error.message, true);
    saved = {
      products: pRes.data || [],
      config: normalizeConfig(cRes.data),
    };
    draft = clone(saved);
    updateSaveBar();
  }

  function isDirty() {
    return saved && draft && JSON.stringify(saved) !== JSON.stringify(draft);
  }

  function updateSaveBar() {
    saveBar.classList.toggle("hidden", !isDirty());
  }

  // markDirty only refreshes the save bar (keeps input focus); callers re-render
  // explicitly after structural changes.
  function markDirty() {
    updateSaveBar();
  }

  // ============================================================== navigation
  function setActive(view) {
    activeView = view;
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === view)
    );
    Object.keys(panels).forEach((k) =>
      panels[k].classList.toggle("hidden", k !== view)
    );
    renderActive();
  }

  function renderActive() {
    if (activeView === "listings") renderListings();
    else if (activeView === "home") renderHome();
    else if (activeView === "featured") renderFeatured();
    else if (activeView === "contact") renderContact();
  }

  // ============================================================== save/discard
  function productRow(p) {
    return {
      id: p.id,
      name: p.name,
      category: p.category || "other",
      series: p.series || null,
      image_url: p.image_url || null,
      description: p.description || null,
      price: p.price || null,
      in_stock: !!p.in_stock,
      whatsapp_number: p.whatsapp_number || null,
      specs: p.specs || {},
      is_featured: !!p.is_featured,
      sort_order: Number(p.sort_order) || 0,
    };
  }

  async function saveAll() {
    if (!isDirty()) return;
    const ok = await confirmDialog(
      "Save changes? This updates the live website immediately."
    );
    if (!ok) return;
    try {
      const delIds = saved.products
        .filter((p) => !draft.products.find((d) => d.id === p.id))
        .map((p) => p.id);
      if (delIds.length) {
        const { error } = await sb.from("products").delete().in("id", delIds);
        if (error) throw error;
      }
      if (draft.products.length) {
        const { error } = await sb
          .from("products")
          .upsert(draft.products.map(productRow));
        if (error) throw error;
      }
      const { error: cErr } = await sb.from("site_config").upsert({
        id: 1,
        hero: draft.config.hero,
        home_sections: draft.config.home_sections,
        suggestions: draft.config.suggestions,
        contact: draft.config.contact,
        updated_at: new Date().toISOString(),
      });
      if (cErr) throw cErr;

      saved = clone(draft);
      updateSaveBar();
      toast("Saved — changes are live on the site.");
    } catch (err) {
      console.error(err);
      toast(err.message || "Save failed", true);
    }
  }

  async function discardAll() {
    if (!isDirty()) return;
    const ok = await confirmDialog(
      "Discard all unsaved changes? They will be lost."
    );
    if (!ok) return;
    draft = clone(saved);
    updateSaveBar();
    renderActive();
    toast("Changes discarded.");
  }

  // ============================================================== confirm modal
  function confirmDialog(message) {
    return new Promise((resolve) => {
      confirmMessage.textContent = message || "Are you sure you want to continue?";
      confirmModal.classList.remove("hidden");
      const cleanup = (val) => {
        confirmModal.classList.add("hidden");
        confirmOk.removeEventListener("click", onOk);
        confirmCancel.removeEventListener("click", onCancel);
        resolve(val);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      confirmOk.addEventListener("click", onOk);
      confirmCancel.addEventListener("click", onCancel);
    });
  }

  // ============================================================== LISTINGS
  function renderListings() {
    const rows = draft.products
      .map(
        (p) => `
      <tr class="border-b border-gray-100">
        <td class="py-2 pr-3"><img src="${esc(p.image_url)}" alt="" class="w-10 h-10 object-contain bg-gray-50 rounded"/></td>
        <td class="py-2 pr-3 font-medium">${esc(p.name)}</td>
        <td class="py-2 pr-3 text-gray-500">${esc(p.category)}</td>
        <td class="py-2 pr-3">${esc(p.price)}</td>
        <td class="py-2 pr-3 text-center">${p.in_stock ? "✅" : "—"}</td>
        <td class="py-2 pr-3 text-center">${p.is_featured ? "⭐" : "—"}</td>
        <td class="py-2 pr-3 whitespace-nowrap text-right">
          <button data-action="edit-product" data-id="${esc(p.id)}" class="text-sm text-gray-700 hover:text-gray-900 font-medium">Edit</button>
          <button data-action="delete-product" data-id="${esc(p.id)}" class="text-sm text-red-600 hover:text-red-700 font-medium ml-3">Delete</button>
        </td>
      </tr>`
      )
      .join("");

    panels.listings.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">Listings <span class="text-gray-400 font-normal text-base">(${draft.products.length})</span></h2>
        <button data-action="add-product" class="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">+ Add product</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-gray-400 border-b border-gray-200">
            <th class="py-2 pr-3"></th><th class="py-2 pr-3">Name</th><th class="py-2 pr-3">Category</th>
            <th class="py-2 pr-3">Price</th><th class="py-2 pr-3 text-center">Stock</th>
            <th class="py-2 pr-3 text-center">Featured</th><th class="py-2 pr-3"></th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="7" class="py-8 text-center text-gray-400">No products yet.</td></tr>`}</tbody>
        </table>
      </div>`;
  }

  // ============================================================== PRODUCT MODAL
  function blankProduct() {
    return {
      id: "",
      name: "",
      category: "other",
      series: "",
      image_url: "",
      description: "",
      price: "",
      in_stock: true,
      whatsapp_number: "9779800000000",
      specs: {},
      is_featured: false,
      sort_order: draft.products.length,
    };
  }

  function openProductModal(id) {
    editingId = id;
    const p = id ? draft.products.find((x) => x.id === id) : blankProduct();
    if (!p) return;
    $("product-modal-title").textContent = id ? "Edit product" : "Add product";
    $("pf-id").value = p.id || "";
    $("pf-name").value = p.name || "";
    $("pf-category").value = p.category || "";
    $("pf-series").value = p.series || "";
    $("pf-price").value = p.price || "";
    $("pf-whatsapp").value = p.whatsapp_number || "";
    $("pf-sort").value = p.sort_order || 0;
    $("pf-instock").checked = !!p.in_stock;
    $("pf-featured").checked = !!p.is_featured;
    $("pf-description").value = p.description || "";
    $("pf-image-url").value = p.image_url || "";
    $("pf-image-preview").src = p.image_url || "";
    $("pf-image-status").textContent = "";
    $("pf-error").classList.add("hidden");
    renderSpecsEditor(p.specs || {});
    productModal.classList.remove("hidden");
  }

  function closeProductModal() {
    productModal.classList.add("hidden");
    editingId = null;
  }

  function renderSpecsEditor(specs) {
    $("pf-specs").innerHTML = "";
    const entries = Object.entries(specs);
    if (entries.length === 0) addSpecRow("", "");
    else entries.forEach(([k, v]) => addSpecRow(k, v));
  }

  function addSpecRow(key, value) {
    const row = document.createElement("div");
    row.className = "flex gap-2 spec-row";
    row.innerHTML = `
      <input type="text" value="${esc(key)}" placeholder="Label" class="spec-key flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
      <input type="text" value="${esc(value)}" placeholder="Value" class="spec-value flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
      <button type="button" data-action="remove-spec" class="px-2 text-red-500 hover:text-red-700">✕</button>`;
    $("pf-specs").appendChild(row);
  }

  async function onImageFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const id = $("pf-id").value.trim() || slug($("pf-name").value) || "misc";
    $("pf-image-status").textContent = "Uploading…";
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await sb.storage
        .from("product-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const url = sb.storage.from("product-images").getPublicUrl(path).data
        .publicUrl;
      $("pf-image-url").value = url;
      $("pf-image-preview").src = url;
      $("pf-image-status").textContent = "Uploaded ✓";
    } catch (err) {
      console.error(err);
      $("pf-image-status").textContent = "Upload failed: " + (err.message || "");
    }
  }

  function applyProduct(e) {
    e.preventDefault();
    const errEl = $("pf-error");
    errEl.classList.add("hidden");

    const name = $("pf-name").value.trim();
    if (!name) return showFormError("Name is required.");
    const id = $("pf-id").value.trim() || slug(name);
    if (!id) return showFormError("Could not generate an ID — set one manually.");

    // Unique id check (allow keeping the same id when editing)
    const clash = draft.products.find((p) => p.id === id && p.id !== editingId);
    if (clash) return showFormError(`Another product already uses the ID "${id}".`);

    // Gather specs
    const specs = {};
    document.querySelectorAll("#pf-specs .spec-row").forEach((row) => {
      const k = row.querySelector(".spec-key").value.trim();
      const v = row.querySelector(".spec-value").value.trim();
      if (k) specs[k] = v;
    });

    const product = {
      id,
      name,
      category: $("pf-category").value.trim() || "other",
      series: $("pf-series").value.trim(),
      image_url: $("pf-image-url").value.trim(),
      description: $("pf-description").value.trim(),
      price: $("pf-price").value.trim(),
      in_stock: $("pf-instock").checked,
      whatsapp_number: $("pf-whatsapp").value.trim(),
      specs,
      is_featured: $("pf-featured").checked,
      sort_order: Number($("pf-sort").value) || 0,
    };

    if (editingId) {
      const idx = draft.products.findIndex((p) => p.id === editingId);
      draft.products[idx] = product;
      // keep suggestions referencing the (possibly renamed) id consistent
      if (editingId !== id) {
        draft.config.suggestions = draft.config.suggestions.map((s) =>
          s === editingId ? id : s
        );
      }
    } else {
      draft.products.push(product);
    }

    closeProductModal();
    renderListings();
    markDirty();
  }

  function showFormError(msg) {
    const errEl = $("pf-error");
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }

  function deleteProduct(id) {
    const idx = draft.products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    draft.products.splice(idx, 1);
    draft.config.suggestions = draft.config.suggestions.filter((s) => s !== id);
    renderListings();
    markDirty();
    toast("Removed (unsaved — Save to apply, Discard to undo).");
  }

  // ============================================================== HOME EDITOR
  function renderHome() {
    const h = draft.config.hero || {};
    const sections = draft.config.home_sections || [];
    const sectionRows = sections
      .map(
        (s, i) => `
      <div class="flex flex-wrap items-center gap-3 border border-gray-200 rounded-lg p-3">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" data-section-visible data-index="${i}" ${s.visible === false ? "" : "checked"} class="w-4 h-4"/> Visible
        </label>
        <span class="text-xs text-gray-400 uppercase tracking-wide">${esc(s.type)}${s.category ? " · " + esc(s.category) : ""}</span>
        <input type="text" data-section-title data-index="${i}" value="${esc(s.title)}" placeholder="Section title" class="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
        <label class="text-sm text-gray-500">Limit
          <input type="number" data-section-limit data-index="${i}" value="${Number(s.limit) || 8}" class="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm ml-1"/>
        </label>
        <span class="ml-auto flex gap-1">
          <button data-action="section-up" data-index="${i}" class="px-2 py-1 rounded border border-gray-200 text-sm" ${i === 0 ? "disabled" : ""}>↑</button>
          <button data-action="section-down" data-index="${i}" class="px-2 py-1 rounded border border-gray-200 text-sm" ${i === sections.length - 1 ? "disabled" : ""}>↓</button>
        </span>
      </div>`
      )
      .join("");

    panels.home.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Home page</h2>
      <div class="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 class="font-semibold mb-3">Hero</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="text-sm">Title<input type="text" data-hero="title" value="${esc(h.title)}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></label>
          <label class="text-sm">Subtitle<input type="text" data-hero="subtitle" value="${esc(h.subtitle)}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></label>
          <label class="text-sm">Image URL<input type="text" data-hero="image" value="${esc(h.image)}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></label>
          <label class="text-sm">CTA text<input type="text" data-hero="ctaText" value="${esc(h.ctaText)}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></label>
          <label class="text-sm">CTA link<input type="text" data-hero="ctaLink" value="${esc(h.ctaLink)}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></label>
        </div>
        <p class="text-xs text-gray-400 mt-3">Note: the current home page uses a fixed category banner; these hero fields are stored for use by hero-driven layouts.</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5">
        <h3 class="font-semibold mb-3">Sections (order, visibility, titles)</h3>
        <div class="space-y-3">${sectionRows || '<p class="text-gray-400 text-sm">No sections configured.</p>'}</div>
      </div>`;
  }

  // ============================================================== FEATURED/SUGGESTIONS
  function renderFeatured() {
    const featuredRows = draft.products
      .map(
        (p) => `
      <label class="flex items-center gap-2 py-1.5 text-sm border-b border-gray-100">
        <input type="checkbox" data-action="toggle-featured" data-id="${esc(p.id)}" ${p.is_featured ? "checked" : ""} class="w-4 h-4"/>
        <span class="flex-1">${esc(p.name)}</span>
        <span class="text-gray-400 text-xs">${esc(p.category)}</span>
      </label>`
      )
      .join("");

    const sugg = draft.config.suggestions || [];
    const selectedRows = sugg
      .map((id, i) => {
        const p = draft.products.find((x) => x.id === id);
        const label = p ? p.name : `${id} (missing)`;
        return `
      <div class="flex items-center gap-2 py-1.5 text-sm border-b border-gray-100">
        <span class="text-gray-400 w-5">${i + 1}.</span>
        <span class="flex-1">${esc(label)}</span>
        <button data-action="suggestion-up" data-index="${i}" class="px-2 rounded border border-gray-200" ${i === 0 ? "disabled" : ""}>↑</button>
        <button data-action="suggestion-down" data-index="${i}" class="px-2 rounded border border-gray-200" ${i === sugg.length - 1 ? "disabled" : ""}>↓</button>
      </div>`;
      })
      .join("");

    const availRows = draft.products
      .map(
        (p) => `
      <label class="flex items-center gap-2 py-1.5 text-sm border-b border-gray-100">
        <input type="checkbox" data-action="toggle-suggestion" data-id="${esc(p.id)}" ${sugg.includes(p.id) ? "checked" : ""} class="w-4 h-4"/>
        <span class="flex-1">${esc(p.name)}</span>
      </label>`
      )
      .join("");

    panels.featured.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Featured &amp; Suggestions</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="font-semibold mb-3">Featured products <span class="text-gray-400 font-normal text-sm">(shown in the Featured grid)</span></h3>
          <div class="max-h-[420px] overflow-y-auto">${featuredRows}</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="font-semibold mb-3">Suggestions</h3>
          <p class="text-xs text-gray-400 mb-2">Tick products to suggest, then order them:</p>
          <div class="mb-4">${selectedRows || '<p class="text-gray-400 text-sm">None selected.</p>'}</div>
          <details>
            <summary class="text-sm font-medium cursor-pointer text-gray-700">Choose products</summary>
            <div class="max-h-[300px] overflow-y-auto mt-2">${availRows}</div>
          </details>
        </div>
      </div>`;
  }

  // ============================================================== CONTACT EDITOR
  function renderContact() {
    const c = draft.config.contact || {};
    const field = (label, key, val) =>
      `<label class="text-sm block">${label}
        <input type="text" data-contact="${key}" value="${esc(val)}" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
      </label>`;
    const area = (label, key, val) =>
      `<label class="text-sm block">${label}
        <textarea data-contact="${key}" rows="3" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">${esc(val)}</textarea>
      </label>`;

    panels.contact.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Contact page</h2>
      <div class="bg-white rounded-xl shadow-sm p-5 space-y-4 max-w-3xl">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${field("Eyebrow (small heading)", "eyebrow", c.eyebrow)}
          ${field("Headline", "headline", c.headline)}
        </div>
        ${area("Intro text", "intro", c.intro)}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${field("Phone (display)", "phone", c.phone)}
          ${field("WhatsApp number (digits, e.g. 9779761800954)", "whatsapp_number", c.whatsapp_number)}
          ${field("Email", "email", c.email)}
        </div>
        ${area("Address (one line each)", "address", c.address)}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${field("Hours — weekdays", "hours_weekday", c.hours_weekday)}
          ${field("Hours — Saturday", "hours_saturday", c.hours_saturday)}
          ${field("Instagram URL", "instagram_url", c.instagram_url)}
          ${field("Facebook URL", "facebook_url", c.facebook_url)}
        </div>
      </div>`;
  }

  // ============================================================== delegation
  function onDelegatedClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;
    const index = el.dataset.index != null ? Number(el.dataset.index) : null;

    switch (action) {
      case "add-product":
        openProductModal(null);
        break;
      case "edit-product":
        openProductModal(id);
        break;
      case "delete-product":
        deleteProduct(id);
        break;
      case "remove-spec":
        el.closest(".spec-row").remove();
        break;
      case "section-up":
        moveItem(draft.config.home_sections, index, -1);
        renderHome();
        markDirty();
        break;
      case "section-down":
        moveItem(draft.config.home_sections, index, 1);
        renderHome();
        markDirty();
        break;
      case "suggestion-up":
        moveItem(draft.config.suggestions, index, -1);
        renderFeatured();
        markDirty();
        break;
      case "suggestion-down":
        moveItem(draft.config.suggestions, index, 1);
        renderFeatured();
        markDirty();
        break;
    }
  }

  function onDelegatedInput(e) {
    const t = e.target;
    if (t.dataset.hero != null) {
      draft.config.hero[t.dataset.hero] = t.value;
      markDirty();
    } else if (t.hasAttribute("data-section-title")) {
      draft.config.home_sections[Number(t.dataset.index)].title = t.value;
      markDirty();
    } else if (t.hasAttribute("data-section-limit")) {
      draft.config.home_sections[Number(t.dataset.index)].limit =
        Number(t.value) || 0;
      markDirty();
    } else if (t.dataset.contact != null) {
      if (!draft.config.contact) draft.config.contact = {};
      draft.config.contact[t.dataset.contact] = t.value;
      markDirty();
    }
  }

  function onDelegatedChange(e) {
    const t = e.target;
    if (t.hasAttribute("data-section-visible")) {
      draft.config.home_sections[Number(t.dataset.index)].visible = t.checked;
      markDirty();
    } else if (t.dataset.action === "toggle-featured") {
      const p = draft.products.find((x) => x.id === t.dataset.id);
      if (p) p.is_featured = t.checked;
      markDirty();
    } else if (t.dataset.action === "toggle-suggestion") {
      const id = t.dataset.id;
      const list = draft.config.suggestions;
      if (t.checked) {
        if (!list.includes(id)) list.push(id);
      } else {
        const i = list.indexOf(id);
        if (i !== -1) list.splice(i, 1);
      }
      renderFeatured();
      markDirty();
    }
  }

  function moveItem(arr, index, delta) {
    const j = index + delta;
    if (j < 0 || j >= arr.length) return;
    const [item] = arr.splice(index, 1);
    arr.splice(j, 0, item);
  }

  // ============================================================== toast
  let toastTimer;
  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className =
      "px-4 py-3 rounded-lg shadow-lg text-sm text-white " +
      (isError ? "bg-red-600" : "bg-gray-900");
    toastEl.classList.remove("hidden");
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = "0";
      setTimeout(() => toastEl.classList.add("hidden"), 300);
    }, 2800);
  }
})();
