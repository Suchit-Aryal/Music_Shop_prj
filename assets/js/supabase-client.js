// Creates the shared Supabase client used by both the public site and the admin.
// Requires (in this order, before this file):
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="assets/js/config.js"></script>
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const configured =
    !!cfg.url &&
    !!cfg.anonKey &&
    !cfg.url.startsWith("YOUR_") &&
    !cfg.anonKey.startsWith("YOUR_");

  window.SUPABASE_CONFIGURED = configured;

  if (configured && window.supabase && typeof window.supabase.createClient === "function") {
    window.supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  } else {
    window.supabaseClient = null;
    if (!configured) {
      console.warn(
        "[MusicShop] Supabase is not configured yet. Edit assets/js/config.js with your project URL and anon key. See SETUP.md."
      );
    }
  }
})();
