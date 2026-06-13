// ---------------------------------------------------------------------------
// Public Supabase configuration.
//
// The anon key is SAFE to ship in frontend code: all database writes are blocked
// by Row Level Security (only a logged-in admin can write). NEVER put the
// service_role key here — it bypasses security and must stay secret.
//
// Fill these two values from your Supabase project:
//   Supabase dashboard -> Project Settings -> API
// ---------------------------------------------------------------------------
window.SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_PROJECT_URL", // e.g. https://abcdefgh.supabase.co
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
