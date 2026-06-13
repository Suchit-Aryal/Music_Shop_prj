// Home page rendering. Reads products + site_config from Supabase (via DataService),
// renders the home sections defined in site_config.home_sections, and runs the
// top category carousel.

document.addEventListener("DOMContentLoaded", async () => {
  initUnifiedCarousel();

  let data;
  try {
    data = await DataService.load();
  } catch (err) {
    console.error("Failed to load products:", err);
    showHomeError();
    return;
  }
  renderHero(data.config.hero);
  renderHomeSections(data.products, data.config);
});

// Fills the editable hero banner from site_config.hero. Hidden if there's nothing to show.
function renderHero(hero) {
  hero = hero || {};
  const banner = document.getElementById("hero-banner");
  if (!banner) return;

  if (!hero.title && !hero.subtitle && !hero.image) {
    banner.style.display = "none";
    return;
  }
  banner.style.display = "";

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "";
  };
  setText("hero-title", hero.title);
  setText("hero-subtitle", hero.subtitle);

  const img = document.getElementById("hero-image");
  if (img) {
    img.src = hero.image || "";
    img.style.display = hero.image ? "" : "none";
  }

  const cta = document.getElementById("hero-cta");
  if (cta) {
    if (hero.ctaText) {
      cta.textContent = hero.ctaText;
      cta.href = hero.ctaLink || "#";
      cta.style.display = "";
    } else {
      cta.style.display = "none";
    }
  }
}

// Maps a config section key to the grid container that already exists in index.html.
const SECTION_CONTAINERS = {
  featured: "featured-grid",
  electronic: "electronics-grid",
  accessories: "accessories-scroll",
  suggestions: "suggestions-grid",
};

function renderHomeSections(products, config) {
  const sections = (config && config.home_sections) || [];

  sections.forEach((section) => {
    const containerId = SECTION_CONTAINERS[section.key];
    if (!containerId) return; // unknown section, no place to render
    const container = document.getElementById(containerId);
    if (!container) return;
    const sectionEl = container.closest("section");

    if (section.visible === false) {
      if (sectionEl) sectionEl.style.display = "none";
      return;
    }

    const items = selectItems(products, section, config);

    // The suggestions section stays hidden until something is actually suggested.
    if (section.type === "suggestions" && items.length === 0) {
      if (sectionEl) sectionEl.style.display = "none";
      return;
    }

    if (sectionEl) sectionEl.style.display = "";

    // Optionally sync the section heading with the configured title.
    if (section.title && sectionEl) {
      const heading = sectionEl.querySelector("h2");
      if (heading) heading.textContent = section.title;
    }

    const isScroll = containerId === "accessories-scroll";
    container.innerHTML = items.length
      ? items.map((p) => createCardHtml(p, isScroll)).join("")
      : `<div class="col-span-full text-center py-8 text-gray-400">No items yet.</div>`;
  });

  reorderSections(sections);
}

// Reorders the managed home sections in the DOM to match the configured order.
// Managed sections are moved (in order) to sit just before the MPro CTA anchor,
// leaving the hero carousel (first) and the CTA (last) in place.
function reorderSections(sections) {
  const anchor = document.getElementById("mpro-cta");
  if (!anchor || !anchor.parentElement) return;
  const main = anchor.parentElement;
  sections.forEach((section) => {
    const containerId = SECTION_CONTAINERS[section.key];
    if (!containerId) return;
    const container = document.getElementById(containerId);
    const sectionEl = container && container.closest("section");
    if (sectionEl) main.insertBefore(sectionEl, anchor);
  });
}

function selectItems(products, section, config) {
  const limit = section.limit || 8;

  if (section.type === "featured") {
    let featured = products.filter((p) => p.is_featured);
    // Fallback so the grid is never empty if nothing is flagged yet.
    if (featured.length === 0) {
      featured = products.filter(
        (p) => Number(String(p.price).replace(/[^0-9]/g, "")) > 20000
      );
    }
    return featured.slice(0, limit);
  }

  if (section.type === "suggestions") {
    const ids = (config && config.suggestions) || [];
    return ids
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
      .slice(0, limit);
  }

  // category section
  return products
    .filter((p) => p.category === section.category)
    .slice(0, limit);
}

function showHomeError() {
  const grid = document.getElementById("featured-grid");
  if (grid) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">
      Couldn't load products right now. Please try again later.</div>`;
  }
}

function createCardHtml(product, isScroll) {
  const scrollClasses = isScroll
    ? "min-w-[200px] w-[200px] sm:w-[240px] flex-shrink-0 bg-white rounded-xl p-4 shadow-sm snap-center hover:shadow-lg transition-all group block border border-transparent hover:border-yellow-200"
    : "bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border border-gray-100";

  const imgContainerClasses = isScroll
    ? "aspect-square bg-gray-50 rounded-lg mb-4 p-4 flex items-center justify-center"
    : "aspect-square p-4 flex items-center justify-center relative";

  const contentClasses = isScroll ? "" : "p-4 border-t border-gray-50";

  return `
    <a href="product.html?id=${encodeURIComponent(product.id)}" class="${scrollClasses}">
        <div class="${imgContainerClasses}">
            <img src="${product.image_url}" alt="${product.name}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy"/>
        </div>
        <div class="${contentClasses}">
            <h3 class="font-bold text-gray-900 truncate">${product.name}</h3>
            <p class="text-yellow-600 font-medium">${product.price}</p>
        </div>
    </a>
    `;
}

function initUnifiedCarousel() {
  const track = document.getElementById("category-track");
  const prevBtn = document.getElementById("cat-prev-btn");
  const nextBtn = document.getElementById("cat-next-btn");

  if (!track) return;

  let items = Array.from(track.children);
  const totalItems = items.length;
  let itemsPerScreen = window.innerWidth >= 768 ? 3 : 1;
  let currentIndex = itemsPerScreen;
  let autoPlayInterval;
  let isTransitioning = false;

  const cloneCount = itemsPerScreen;
  track.innerHTML = "";

  const clonesStart = items.slice(-cloneCount).map((item) => {
    const clone = item.cloneNode(true);
    clone.classList.add("clone");
    return clone;
  });
  const clonesEnd = items.slice(0, cloneCount).map((item) => {
    const clone = item.cloneNode(true);
    clone.classList.add("clone");
    return clone;
  });
  [...clonesStart, ...items, ...clonesEnd].forEach((item) => track.appendChild(item));

  function updateResponsiveVars() {
    const newItemsPerScreen = window.innerWidth >= 768 ? 3 : 1;
    if (newItemsPerScreen !== itemsPerScreen) {
      location.reload();
    }
    itemsPerScreen = newItemsPerScreen;
  }

  function updateCarousel(enableTransition = true) {
    const widthPercentage = 100 / itemsPerScreen;
    const translateX = -(currentIndex * widthPercentage);
    track.style.transition = enableTransition ? "transform 0.5s ease-in-out" : "none";
    track.style.transform = `translateX(${translateX}%)`;
  }

  updateCarousel(false);

  track.addEventListener("transitionend", () => {
    isTransitioning = false;
    if (currentIndex >= totalItems + cloneCount) {
      currentIndex = cloneCount;
      updateCarousel(false);
    }
    if (currentIndex < cloneCount) {
      currentIndex = totalItems + cloneCount - 1;
      updateCarousel(false);
    }
  });

  function next() {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex++;
    updateCarousel(true);
  }
  function prev() {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex--;
    updateCarousel(true);
  }
  function startAutoPlay() {
    stopAutoPlay();
    autoPlayInterval = setInterval(next, 3000);
  }
  function stopAutoPlay() {
    if (autoPlayInterval) clearInterval(autoPlayInterval);
  }

  window.addEventListener("resize", updateResponsiveVars);
  if (nextBtn) nextBtn.addEventListener("click", () => { stopAutoPlay(); next(); startAutoPlay(); });
  if (prevBtn) prevBtn.addEventListener("click", () => { stopAutoPlay(); prev(); startAutoPlay(); });
  track.parentElement.addEventListener("mouseenter", stopAutoPlay);
  track.parentElement.addEventListener("mouseleave", startAutoPlay);

  let touchStartX = 0;
  track.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].screenX; stopAutoPlay(); }, { passive: true });
  track.addEventListener("touchend", (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    startAutoPlay();
  }, { passive: true });

  startAutoPlay();
}
