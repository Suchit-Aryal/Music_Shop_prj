// assets/js/product.js
// Dynamic product loading functionality

// Render hook + current id, used by the live-edit overlay.
window.MSProduct = { id: null, render: (p) => renderProduct(p) };

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
  window.MSProduct.id = productId;

  try {
    const product = await DataService.getProduct(productId);

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

  // Tag the detail container with the product id for live editing
  document.getElementById("product-content").setAttribute("data-prod-id", product.id);

  // Update product info
  document.getElementById("product-image").src = product.image_url;
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
  if (product.in_stock) {
    stockBadge.textContent = "In Stock";
    stockBadge.className = "inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide mb-2";
  } else {
    stockBadge.textContent = "Out of Stock";
    stockBadge.className = "inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide mb-2";
  }

  // Update WhatsApp link
  const whatsappMessage = encodeURIComponent(`Hi, I am interested in the ${product.name}.`);
  document.getElementById("whatsapp-link").href = `https://wa.me/${product.whatsapp_number}?text=${whatsappMessage}`;

  // Render specifications table
  const specsBody = document.getElementById("specs-body");
  specsBody.innerHTML = "";

  const specEntries = Object.entries(product.specs || {});
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
