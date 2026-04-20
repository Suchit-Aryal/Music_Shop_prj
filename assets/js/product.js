// assets/js/product.js
// Dynamic product loading functionality

document.addEventListener("DOMContentLoaded", () => {
  // Only run on product.html page
  if (!document.getElementById("product-content")) return;

  loadProduct();
});

/**
 * Get product ID from URL parameter
 * @returns {string|null} Product ID or null if not found
 */
function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

/**
 * Load product data from JSON and render it
 */
async function loadProduct() {
  const productId = getProductIdFromUrl();

  if (!productId) {
    showError();
    return;
  }

  try {
    let products = [];

    // Check for local data object (avoids CORS issues on file://)
    if (typeof window.products !== 'undefined') {
      products = window.products;
    } else {
      // Fallback to fetch
      const response = await fetch("data/products.json");
      if (!response.ok) throw new Error("Failed to load products data");
      const data = await response.json();
      products = data.products;
    }

    const product = products.find((p) => p.id === productId);

    if (product) {
      renderProduct(product);
    } else {
      showError();
    }
  } catch (error) {
    console.error("Error loading product:", error);
    showError();
  }
}

/**
 * Render product data to the page
 * @param {Object} product - Product data object
 */
function renderProduct(product) {
  // Hide loading, show content
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("product-content").classList.remove("hidden");

  // Update page title
  document.getElementById("page-title").textContent = `${product.name} | Traditional Music Instruments`;

  // Update breadcrumb
  document.getElementById("breadcrumb-name").textContent = product.name;

  // Update product info
  document.getElementById("product-image").src = product.image;
  document.getElementById("product-image").alt = product.name;
  document.getElementById("product-name").textContent = product.name;
  document.getElementById("product-description").textContent = product.description;

  // Update price
  const priceEl = document.getElementById("product-price");
  if (priceEl && product.price) {
    priceEl.textContent = product.price;
  }

  // Update stock badge
  const stockBadge = document.getElementById("stock-badge");
  if (product.inStock) {
    stockBadge.textContent = "In Stock";
    stockBadge.className = "inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide mb-2";
  } else {
    stockBadge.textContent = "Out of Stock";
    stockBadge.className = "inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide mb-2";
  }

  // Update WhatsApp link
  const whatsappMessage = encodeURIComponent(`Hi, I am interested in the ${product.name}.`);
  document.getElementById("whatsapp-link").href = `https://wa.me/${product.whatsappNumber}?text=${whatsappMessage}`;

  // Render specifications table
  const specsBody = document.getElementById("specs-body");
  specsBody.innerHTML = "";

  const specEntries = Object.entries(product.specs);
  specEntries.forEach(([key, value], index) => {
    const row = document.createElement("tr");
    row.className = index < specEntries.length - 1 ? "border-b" : "";

    // Create cells safely using textContent
    const keyCell = document.createElement("td");
    keyCell.className = "py-2 font-medium text-gray-700 w-1/3";
    keyCell.textContent = key;

    const valueCell = document.createElement("td");
    valueCell.className = "py-2 text-gray-600";
    valueCell.textContent = value;

    row.appendChild(keyCell);
    row.appendChild(valueCell);
    specsBody.appendChild(row);
  });
}

/**
 * Show error state when product is not found
 */
function showError() {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("error-state").classList.remove("hidden");
  document.getElementById("page-title").textContent = "Product Not Found | Traditional Music Instruments";
}
