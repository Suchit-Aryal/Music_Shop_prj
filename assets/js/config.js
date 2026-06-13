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
  url: "https://cdyfqpruwjvdytqxyyna.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkeWZxcHJ1d2p2ZHl0cXh5eW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDUwNDQsImV4cCI6MjA5NjkyMTA0NH0.4-R81wwfhCo1Wl-kfx6LGyMDSV777FaW0awwu1dzbkA",
};
