// Public read layer for the storefront.
// Fetches products + site_config from Supabase once and caches them in memory
// for the lifetime of the page. All public pages (home, listings, product) use this.
window.DataService = (function () {
  let _cache = null;

  async function load() {
    if (_cache) return _cache;
    if (!window.SUPABASE_CONFIGURED || !window.supabaseClient) {
      throw new Error("Supabase is not configured. See SETUP.md.");
    }
    const sb = window.supabaseClient;
    const [productsRes, configRes] = await Promise.all([
      sb.from("products").select("*").order("sort_order", { ascending: true }),
      sb.from("site_config").select("*").eq("id", 1).single(),
    ]);
    if (productsRes.error) throw productsRes.error;
    if (configRes.error) throw configRes.error;
    _cache = {
      products: productsRes.data || [],
      config: configRes.data || { hero: {}, home_sections: [], suggestions: [] },
    };
    return _cache;
  }

  return {
    load,
    async getProducts() {
      return (await load()).products;
    },
    async getConfig() {
      return (await load()).config;
    },
    async getProduct(id) {
      return (await load()).products.find((p) => p.id === id) || null;
    },
    // Lets pages clear the cache if needed (rarely used on public site).
    reset() {
      _cache = null;
    },
  };
})();
