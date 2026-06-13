// Live inline editing for admins, layered on top of the public pages.
// When a logged-in admin views a page, a floating toolbar appears; entering
// edit mode reveals pencils on editable content (hero, sections, contact,
// product cards/details). Edits are staged in a draft (kept in sessionStorage
// so they survive navigation) and written to Supabase on a confirmed Save.
(function () {
  "use strict";

  const sb = window.supabaseClient;
  const DRAFT_KEY = "ms_live_draft";
  const ACTIVE_KEY = "ms_live_active";

  let saved = null; // baseline {products, config}
  let draft = null; // working copy
  let active = false;
  let panelProductId = null; // product being edited in the slide-over (null = new)

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const slug = (s) =>
    String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function setByPath(obj, path, val) {
    const keys = path.split(".");
    const last = keys.pop();
    let t = obj;
    keys.forEach((k) => {
      if (t[k] == null) t[k] = {};
      t = t[k];
    });
    t[last] = val;
  }

  // ===================================================================== boot
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    if (!window.SUPABASE_CONFIGURED || !sb) return;
    let isAdmin = false;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const { data, error } = await sb.rpc("is_admin");
        isAdmin = !error && data === true;
      }
    } catch (e) {
      return;
    }
    if (!isAdmin) return;

    await loadBaseline();
    buildChrome();

    // Resume an in-progress edit across page navigation.
    const stored = sessionStorage.getItem(DRAFT_KEY);
    if (stored && sessionStorage.getItem(ACTIVE_KEY) === "1") {
      try {
        draft = JSON.parse(stored);
      } catch (e) {
        draft = clone(saved);
      }
      enterEdit(true);
    } else {
      draft = clone(saved);
      if (new URLSearchParams(location.search).get("edit") === "1") enterEdit(false);
    }
    updateToolbar();
  }

  async function loadBaseline() {
    // Reuse the page's already-loaded data when available, else fetch.
    try {
      const data = await window.DataService.load();
      saved = { products: clone(data.products), config: clone(data.config) };
    } catch (e) {
      saved = { products: [], config: { hero: {}, home_sections: [], suggestions: [], contact: {} } };
    }
  }

  // ============================================================== page hooks
  function rerenderPage() {
    if (window.MSHome) window.MSHome.render(draft.products, draft.config);
    else if (window.MSProducts) window.MSProducts.render(draft.products);
    else if (window.MSProduct) {
      const p = draft.products.find((x) => x.id === window.MSProduct.id);
      if (p) window.MSProduct.render(p);
    } else if (window.MSContact) window.MSContact.render(draft.config);
    if (active) decorate();
  }

  // ============================================================== chrome (toolbar/panel/confirm/toast)
  function buildChrome() {
    const tb = document.createElement("div");
    tb.id = "le-toolbar";
    tb.innerHTML = `
      <button id="le-edit" class="le-btn-dark">✏️ Edit page</button>
      <button id="le-save" class="le-btn-primary" style="display:none">Save</button>
      <button id="le-discard" class="le-btn-ghost" style="display:none">Discard</button>
      <button id="le-exit" class="le-btn-ghost" style="display:none">Exit</button>
      <span id="le-dirty" style="display:none">●</span>`;
    document.body.appendChild(tb);

    const panelOverlay = document.createElement("div");
    panelOverlay.id = "le-panel-overlay";
    panelOverlay.innerHTML = `<div id="le-panel"></div>`;
    document.body.appendChild(panelOverlay);
    panelOverlay.addEventListener("click", (e) => {
      if (e.target === panelOverlay) closePanel();
    });

    const confirmOverlay = document.createElement("div");
    confirmOverlay.id = "le-confirm-overlay";
    confirmOverlay.innerHTML = `
      <div id="le-confirm">
        <h3 style="font-weight:700;font-size:1.05rem;margin-bottom:.5rem">Please confirm</h3>
        <p id="le-confirm-msg" style="color:#4b5563;font-size:.9rem;margin-bottom:1.25rem">Are you sure you want to continue?</p>
        <div style="display:flex;justify-content:flex-end;gap:.75rem">
          <button id="le-confirm-cancel" class="le-btn-ghost" style="padding:.5rem 1rem;border-radius:.5rem">Cancel</button>
          <button id="le-confirm-ok" class="le-btn-dark" style="padding:.5rem 1rem;border-radius:.5rem">Continue</button>
        </div>
      </div>`;
    document.body.appendChild(confirmOverlay);

    const toast = document.createElement("div");
    toast.id = "le-toast";
    document.body.appendChild(toast);

    document.getElementById("le-edit").addEventListener("click", () => enterEdit(false));
    document.getElementById("le-save").addEventListener("click", saveAll);
    document.getElementById("le-discard").addEventListener("click", discardAll);
    document.getElementById("le-exit").addEventListener("click", exitEdit);

    window.addEventListener("beforeunload", (e) => {
      if (active && isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  function updateToolbar() {
    const dirty = isDirty();
    document.getElementById("le-edit").style.display = active ? "none" : "";
    document.getElementById("le-save").style.display = active ? "" : "none";
    document.getElementById("le-discard").style.display = active ? "" : "none";
    document.getElementById("le-exit").style.display = active ? "" : "none";
    document.getElementById("le-save").disabled = !dirty;
    document.getElementById("le-discard").disabled = !dirty;
    document.getElementById("le-dirty").style.display = dirty ? "" : "none";
  }

  function isDirty() {
    return saved && draft && JSON.stringify(saved) !== JSON.stringify(draft);
  }
  function persist() {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    sessionStorage.setItem(ACTIVE_KEY, active ? "1" : "0");
    updateToolbar();
  }
  function clearPersisted() {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(ACTIVE_KEY);
  }

  // ============================================================== edit mode
  function enterEdit(resuming) {
    active = true;
    document.body.classList.add("le-on");
    if (!resuming && !sessionStorage.getItem(DRAFT_KEY)) draft = clone(saved);
    rerenderPage(); // render from draft + decorate
    decorate();
    if (!document.getElementById("le-add-tile-host")) addAddProductTile();
    persist();
    updateToolbar();
  }

  async function exitEdit() {
    if (isDirty()) {
      const ok = await confirmDialog("You have unsaved changes. Exit and lose them?");
      if (!ok) return;
    }
    active = false;
    document.body.classList.remove("le-on");
    draft = clone(saved);
    clearPersisted();
    rerenderPage();
    stripDecoration();
    updateToolbar();
  }

  // ============================================================== decoration
  function decorate() {
    // text fields
    document.querySelectorAll("[data-cfg],[data-prod]").forEach((el) => {
      if (el.__leText) return;
      el.__leText = true;
      el.addEventListener("click", onTextClick);
    });
    // config images
    document.querySelectorAll("[data-cfg-img]").forEach((img) => decorateImage(img, "cfg"));
    // product cards
    document.querySelectorAll("[data-prod-card]").forEach(decorateCard);
    // product detail page
    document.querySelectorAll("[data-prod-detail]").forEach(decorateDetail);
  }

  function stripDecoration() {
    document.querySelectorAll(".le-card-tools, .le-img-btn, #le-add-tile-host, .le-detail-edit").forEach((n) => n.remove());
  }

  // ---- inline text ----
  function onTextClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    if (el.isContentEditable) return;
    const original = el.textContent;
    el.contentEditable = "true";
    el.focus();
    document.execCommand && document.getSelection().selectAllChildren(el);

    function commit() {
      el.contentEditable = "false";
      cleanup();
      const v = el.textContent.trim();
      if (el.hasAttribute("data-cfg")) {
        setByPath(draft.config, el.getAttribute("data-cfg"), v);
      } else if (el.hasAttribute("data-prod")) {
        const id = cardIdOf(el);
        const p = draft.products.find((x) => x.id === id);
        if (p) p[el.getAttribute("data-prod")] = v;
      }
      persist();
    }
    function cancel() {
      el.textContent = original;
      el.contentEditable = "false";
      cleanup();
    }
    function onKey(ev) {
      if (ev.key === "Enter" && !el.hasAttribute("data-multiline")) {
        ev.preventDefault();
        el.blur();
      } else if (ev.key === "Escape") {
        cancel();
      }
    }
    function cleanup() {
      el.removeEventListener("blur", commit);
      el.removeEventListener("keydown", onKey);
    }
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", onKey);
  }

  function cardIdOf(el) {
    const card = el.closest("[data-prod-id]");
    if (card) return card.getAttribute("data-prod-id");
    if (window.MSProduct) return window.MSProduct.id;
    return null;
  }

  // ---- inline image ----
  function decorateImage(img, kind) {
    if (img.__leImg) return;
    img.__leImg = true;
    const wrap = img.closest(".le-img-wrap") || wrapImage(img);
    const btn = document.createElement("button");
    btn.className = "le-img-btn";
    btn.textContent = "📷 Change";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      pickImage(async (url) => {
        img.src = url;
        if (kind === "cfg") setByPath(draft.config, img.getAttribute("data-cfg-img"), url);
        else {
          const id = cardIdOf(img);
          const p = draft.products.find((x) => x.id === id);
          if (p) p.image_url = url;
        }
        persist();
      });
    });
    wrap.appendChild(btn);
  }
  function wrapImage(img) {
    const wrap = document.createElement("span");
    wrap.className = "le-img-wrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
    return wrap;
  }

  function pickImage(cb) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      toast("Uploading image…");
      try {
        const path = `live/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error } = await sb.storage.from("product-images").upload(path, file, { upsert: true });
        if (error) throw error;
        const url = sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
        toast("Image uploaded");
        cb(url);
      } catch (err) {
        toast(err.message || "Upload failed", true);
      }
    };
    input.click();
  }

  // ---- product cards ----
  function decorateCard(card) {
    if (card.querySelector(".le-card-tools")) return;
    card.classList.add("le-card-wrap");
    const id = card.getAttribute("data-prod-id");
    // block navigation while editing
    card.addEventListener("click", (e) => {
      if (active) e.preventDefault();
    });
    const tools = document.createElement("div");
    tools.className = "le-card-tools";
    tools.innerHTML = `<button class="le-edit-card">Edit</button><button class="le-del">✕</button>`;
    tools.querySelector(".le-edit-card").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      openPanel(id);
    });
    tools.querySelector(".le-del").addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const ok = await confirmDialog("Delete this product? (Save to apply, Discard to undo.)");
      if (!ok) return;
      deleteProduct(id);
    });
    card.appendChild(tools);
  }

  // ---- product detail ----
  function decorateDetail(container) {
    if (container.querySelector(".le-detail-edit")) return;
    const id = container.getAttribute("data-prod-id") || (window.MSProduct && window.MSProduct.id);
    const btn = document.createElement("button");
    btn.className = "le-detail-edit le-btn-dark";
    btn.style.cssText = "margin-bottom:1rem;padding:.5rem 1rem;border-radius:.5rem;font-size:.85rem;font-weight:600";
    btn.textContent = "✏️ Edit all details";
    btn.addEventListener("click", () => openPanel(id));
    container.prepend(btn);
  }

  // ============================================================== add-product tile
  function addAddProductTile() {
    // Add a tile to the first product grid on the page.
    const grid =
      document.getElementById("featured-grid") ||
      document.getElementById("product-grid");
    if (!grid) return;
    const tile = document.createElement("div");
    tile.id = "le-add-tile-host";
    tile.className = "le-add-tile";
    tile.textContent = "＋ Add product";
    tile.addEventListener("click", () => openPanel(null));
    grid.appendChild(tile);
  }

  // ============================================================== product panel
  function blankProduct() {
    return {
      id: "", name: "", category: "other", series: "", image_url: "",
      description: "", price: "", in_stock: true, whatsapp_number: "9779800000000",
      specs: {}, is_featured: false, sort_order: draft.products.length,
    };
  }

  function openPanel(id) {
    panelProductId = id;
    const p = id ? draft.products.find((x) => x.id === id) : blankProduct();
    if (!p) return;
    const specRows = Object.entries(p.specs || {})
      .map(([k, v]) => specRowHtml(k, v))
      .join("");
    document.getElementById("le-panel").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="font-weight:700;font-size:1.1rem">${id ? "Edit product" : "Add product"}</h3>
        <button id="le-panel-close" class="le-btn-ghost" style="padding:.3rem .8rem;border-radius:.5rem">Close</button>
      </div>
      <label>Product ID (slug)<input id="lp-id" type="text" value="${esc(p.id)}"/></label>
      <label>Name<input id="lp-name" type="text" value="${esc(p.name)}"/></label>
      <label>Category<input id="lp-category" type="text" value="${esc(p.category)}"/></label>
      <label>Series<input id="lp-series" type="text" value="${esc(p.series)}"/></label>
      <label>Price<input id="lp-price" type="text" value="${esc(p.price)}"/></label>
      <label>WhatsApp number<input id="lp-whatsapp" type="text" value="${esc(p.whatsapp_number)}"/></label>
      <label>Sort order<input id="lp-sort" type="number" value="${Number(p.sort_order) || 0}"/></label>
      <label style="display:flex;gap:1.5rem;margin-top:1rem">
        <span style="display:flex;align-items:center;gap:.4rem"><input id="lp-instock" type="checkbox" ${p.in_stock ? "checked" : ""} style="width:auto"/> In stock</span>
        <span style="display:flex;align-items:center;gap:.4rem"><input id="lp-featured" type="checkbox" ${p.is_featured ? "checked" : ""} style="width:auto"/> Featured</span>
      </label>
      <label>Description<textarea id="lp-description" rows="3">${esc(p.description)}</textarea></label>
      <label>Image</label>
      <div style="display:flex;gap:.75rem;align-items:center;margin-top:.25rem">
        <img id="lp-image-preview" src="${esc(p.image_url)}" alt="" style="width:64px;height:64px;object-fit:contain;background:#f3f4f6;border-radius:.5rem"/>
        <div style="flex:1">
          <input id="lp-image-url" type="text" value="${esc(p.image_url)}" placeholder="Image URL"/>
          <button id="lp-image-upload" class="le-btn-ghost" style="margin-top:.4rem;padding:.3rem .8rem;border-radius:.5rem;font-size:.8rem">Upload image</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem">
        <span style="font-size:.85rem;font-weight:600">Specifications</span>
        <button id="lp-add-spec" class="le-btn-ghost" style="padding:.2rem .7rem;border-radius:.5rem;font-size:.8rem">+ Add</button>
      </div>
      <div id="lp-specs">${specRows}</div>
      <p id="lp-error" style="color:#dc2626;font-size:.85rem;margin-top:.5rem;display:none"></p>
      <div style="display:flex;gap:.75rem;margin-top:1.25rem">
        <button id="lp-apply" class="le-btn-primary" style="flex:1;padding:.6rem;border-radius:.5rem">Apply</button>
        ${id ? '<button id="lp-delete" class="le-btn-ghost" style="padding:.6rem 1rem;border-radius:.5rem;color:#dc2626">Delete</button>' : ""}
      </div>`;

    document.getElementById("le-panel-overlay").classList.add("le-open");

    document.getElementById("le-panel-close").onclick = closePanel;
    document.getElementById("lp-add-spec").onclick = () => {
      document.getElementById("lp-specs").insertAdjacentHTML("beforeend", specRowHtml("", ""));
    };
    document.getElementById("lp-specs").addEventListener("click", (e) => {
      if (e.target.classList.contains("lp-spec-del")) e.target.closest(".lp-spec-row").remove();
    });
    document.getElementById("lp-image-url").addEventListener("input", (e) => {
      document.getElementById("lp-image-preview").src = e.target.value;
    });
    document.getElementById("lp-image-upload").onclick = () =>
      pickImage((url) => {
        document.getElementById("lp-image-url").value = url;
        document.getElementById("lp-image-preview").src = url;
      });
    document.getElementById("lp-apply").onclick = applyPanel;
    const delBtn = document.getElementById("lp-delete");
    if (delBtn)
      delBtn.onclick = async () => {
        const ok = await confirmDialog("Delete this product? (Save to apply, Discard to undo.)");
        if (!ok) return;
        deleteProduct(panelProductId);
        closePanel();
      };
  }

  function specRowHtml(k, v) {
    return `<div class="lp-spec-row" style="display:flex;gap:.5rem;margin-top:.4rem">
      <input class="lp-spec-key" type="text" value="${esc(k)}" placeholder="Label" style="flex:1"/>
      <input class="lp-spec-val" type="text" value="${esc(v)}" placeholder="Value" style="flex:1"/>
      <button type="button" class="lp-spec-del le-btn-ghost" style="padding:.2rem .6rem;border-radius:.5rem;color:#dc2626">✕</button>
    </div>`;
  }

  function closePanel() {
    document.getElementById("le-panel-overlay").classList.remove("le-open");
    panelProductId = null;
  }

  function applyPanel() {
    const val = (id) => document.getElementById(id).value.trim();
    const err = document.getElementById("lp-error");
    const name = val("lp-name");
    if (!name) return showPanelError("Name is required.");
    const id = val("lp-id") || slug(name);
    if (!id) return showPanelError("Could not generate an ID — set one manually.");
    const clash = draft.products.find((p) => p.id === id && p.id !== panelProductId);
    if (clash) return showPanelError(`Another product already uses the ID "${id}".`);

    const specs = {};
    document.querySelectorAll("#lp-specs .lp-spec-row").forEach((row) => {
      const k = row.querySelector(".lp-spec-key").value.trim();
      const v = row.querySelector(".lp-spec-val").value.trim();
      if (k) specs[k] = v;
    });

    const product = {
      id, name,
      category: val("lp-category") || "other",
      series: val("lp-series"),
      image_url: val("lp-image-url"),
      description: val("lp-description"),
      price: val("lp-price"),
      in_stock: document.getElementById("lp-instock").checked,
      whatsapp_number: val("lp-whatsapp"),
      specs,
      is_featured: document.getElementById("lp-featured").checked,
      sort_order: Number(val("lp-sort")) || 0,
    };

    if (panelProductId) {
      const idx = draft.products.findIndex((p) => p.id === panelProductId);
      draft.products[idx] = product;
      if (panelProductId !== id) {
        draft.config.suggestions = (draft.config.suggestions || []).map((s) => (s === panelProductId ? id : s));
      }
    } else {
      draft.products.push(product);
    }
    closePanel();
    persist();
    rerenderPage();
    if (active) { decorate(); addAddProductTile(); }
    toast("Updated (unsaved)");
  }

  function showPanelError(msg) {
    const err = document.getElementById("lp-error");
    err.textContent = msg;
    err.style.display = "";
  }

  function deleteProduct(id) {
    const idx = draft.products.findIndex((p) => p.id === id);
    if (idx === -1) return;
    draft.products.splice(idx, 1);
    draft.config.suggestions = (draft.config.suggestions || []).filter((s) => s !== id);
    persist();
    rerenderPage();
    if (active) { decorate(); addAddProductTile(); }
    toast("Removed (unsaved)");
  }

  // ============================================================== save / discard
  async function saveAll() {
    if (!isDirty()) return;
    const ok = await confirmDialog("Save changes? This updates the live website immediately.");
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
        const { error } = await sb.from("products").upsert(draft.products.map(productRow));
        if (error) throw error;
      }
      const c = draft.config;
      const { error: cErr } = await sb.from("site_config").upsert({
        id: 1, hero: c.hero, home_sections: c.home_sections,
        suggestions: c.suggestions, contact: c.contact,
        updated_at: new Date().toISOString(),
      });
      if (cErr) throw cErr;

      saved = clone(draft);
      clearPersisted();
      persist();
      toast("Saved — changes are live.");
    } catch (err) {
      toast(err.message || "Save failed", true);
    }
  }

  function productRow(p) {
    return {
      id: p.id, name: p.name, category: p.category || "other", series: p.series || null,
      image_url: p.image_url || null, description: p.description || null, price: p.price || null,
      in_stock: !!p.in_stock, whatsapp_number: p.whatsapp_number || null,
      specs: p.specs || {}, is_featured: !!p.is_featured, sort_order: Number(p.sort_order) || 0,
    };
  }

  async function discardAll() {
    if (!isDirty()) return;
    const ok = await confirmDialog("Discard all unsaved changes? They will be lost.");
    if (!ok) return;
    draft = clone(saved);
    clearPersisted();
    persist();
    rerenderPage();
    if (active) { decorate(); addAddProductTile(); }
    toast("Changes discarded.");
  }

  // ============================================================== confirm + toast
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById("le-confirm-overlay");
      document.getElementById("le-confirm-msg").textContent = message;
      overlay.classList.add("le-open");
      const okBtn = document.getElementById("le-confirm-ok");
      const cancelBtn = document.getElementById("le-confirm-cancel");
      const cleanup = (v) => {
        overlay.classList.remove("le-open");
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(v);
      };
      okBtn.onclick = () => cleanup(true);
      cancelBtn.onclick = () => cleanup(false);
    });
  }

  let toastTimer;
  function toast(msg, isErr) {
    const t = document.getElementById("le-toast");
    t.textContent = msg;
    t.className = isErr ? "le-err" : "";
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 2600);
  }
})();
