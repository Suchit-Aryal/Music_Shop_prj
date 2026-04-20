# 🎵 Traditional Music Instruments — Online Shop

A modern, responsive e-commerce frontend for an Indian classical music instrument shop based in Kathmandu, Nepal. The site showcases traditional instruments (Sitar, Tabla, Bansuri, etc.), electronic music gear, and MPro Audio professional equipment — with **WhatsApp-first** customer communication.

> **Live Stack:** HTML · TailwindCSS (CDN) · Vanilla JavaScript · JSON data  
> **No backend required** — runs from any static file server.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Hero Carousel** | Auto-rotating, infinite-loop carousel with 6 category panels, touch/swipe support, and hover-pause |
| **Product Catalog** | 19 products across 7 categories loaded from `data/products.json` |
| **Category Filtering** | Desktop sidebar + mobile collapsible dropdown, URL-driven filters (`?filter=string`) |
| **Product Detail Page** | Dynamic single-product view with specs table, stock badge, breadcrumb |
| **WhatsApp Integration** | Floating chat popup (FAB) on every page + per-product "Inquire via WhatsApp" links |
| **Responsive Design** | Mobile-first layout with sticky navbar, mobile menu, and adaptive grids |
| **MPro Audio Partner** | Dedicated CTA section linking to [mproaudio.com](https://mproaudio.com/) |
| **Contact Page** | WhatsApp CTA, phone number, showroom info, social links |

---

## 📁 Project Structure

```
whatsapp_popup/
├── index.html              # Homepage — carousel, featured, electronics, accessories
├── products.html           # Full catalog with filtering
├── product.html            # Single product detail (dynamic via ?id=)
├── contact.html            # Contact info, WhatsApp CTA, showroom details
├── data/
│   └── products.json       # Product database (19 items)
├── assets/
│   ├── css/
│   │   ├── style.css       # Global custom styles
│   │   └── whatsapp.css    # WhatsApp popup styles
│   ├── js/
│   │   ├── products_data.js  # Legacy inline product data (for file:// fallback)
│   │   ├── home.js           # Homepage carousel & section rendering
│   │   ├── product.js        # Single product page logic
│   │   ├── main.js           # Mobile menu, filter, scroll, form handlers
│   │   └── whatsapp.js       # Floating WhatsApp chat widget
│   └── images/
│       ├── hero/           # Hero & carousel images
│       ├── products/       # Product catalog images
│       └── ui/             # Logo & UI assets
├── convert_products.py     # CSV → JS product data converter utility
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3 (for the dev server) **or** any static file server
- A modern web browser

### Run Locally

```bash
Got to Music_Shop_prj using cd ./Music_Shop_prj then
python3 -m http.server 8000
```

Then open: **http://localhost:8000**

### Expose via Cloudflare Tunnel (optional)

```bash
cloudflared tunnel --url http://localhost:8000
```

---

## 📦 Product Categories

| Category | Examples | Count |
|---|---|---|
| String | Sitar, Tanpura, Sarangi | 4 |
| Percussion | Tabla, Dholak | 3 |
| Wind | Bansuri, Shehnai | 3 |
| Keyboard | Harmonium (Deluxe & Portable) | 2 |
| Electronic | Electric Tanpura, Digital Tabla | 2 |
| Accessories | Cases, Covers, Tuning Hammer | 3 |
| MPro | Studio Mic, Audio Interface | 2 |

### Adding Products

Edit `data/products.json` directly, or use the CSV converter:

```bash
python3 convert_products.py your_data.csv
# Outputs: new_products.js → copy contents into products_data.js or products.json
```

---

## 🔧 Things Left To Do

### 🔴 High Priority

- [ ] **Add unique product images** — Many products share the same hero image (e.g., Sarangi, Tanpura all use `sitar-hero.png`). Each product needs its own photo.
- [ ] **Fix WhatsApp numbers** — Most products and contact links still use the placeholder `9779800000000` instead of the real business number (`9779761800954` used in some places).
- [ ] **Contact form is missing** — The contact page has no form; only WhatsApp CTA and phone number. Add a proper inquiry form (name, email, message).
- [ ] **Social media links are dead** — Instagram and Facebook links on the contact page point to `#`.

### 🟡 Medium Priority

- [ ] **SEO improvements** — Add `<meta>` description tags to `products.html` and `product.html`, add Open Graph / social sharing meta tags to all pages.
- [ ] **Favicon** — No favicon is set; add one using the existing logo.
- [ ] **Products page: missing product count** — Show "Showing X products" text when filtering.
- [ ] **Accessibility** — Add `alt` text review across all images, ensure proper ARIA labels, keyboard navigation for carousel and filters.
- [ ] **404 / Error handling** — No custom 404 page exists; invalid URLs show the default server error.
- [ ] **Price consistency** — Confirm all prices in `products.json` are accurate and up-to-date.

### 🟢 Nice To Have

- [ ] **Search functionality** — Add a product search bar on the products page.
- [ ] **Product image gallery** — Support multiple images per product on the detail page.
- [ ] **"Related Products" section** — Show similar items on the product detail page.
- [ ] **Loading skeleton** — Replace "Loading products..." text with animated skeleton placeholders.
- [ ] **Dark mode toggle** — The site currently only has a light theme.
- [ ] **Google Maps embed** — Add an interactive map on the contact page for the showroom location.
- [ ] **Analytics integration** — Add Google Analytics or similar to track visitor behavior.
- [ ] **Back-to-top button** — Add a scroll-to-top button on long pages.
- [ ] **Performance** — Replace TailwindCSS CDN with a purged production build to reduce page size.
- [ ] **PWA support** — Add a `manifest.json` and service worker for offline access and installability.

---

## 🛠 Tech Stack

- **HTML5** — Semantic markup
- **TailwindCSS** (CDN v3) — Utility-first styling
- **Vanilla JavaScript** — No frameworks, no build step
- **JSON** — Static product data
- **Google Fonts** — Heebo & Open Sans
- **Python** — CSV converter utility + dev server

---

## 📄 License

© 2026 Traditional Music Instruments. All rights reserved.
