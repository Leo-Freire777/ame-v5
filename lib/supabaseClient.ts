import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

console.log("SUPABASE_URL:", SUPABASE_URL);
console.log("ANON_KEY_LEN:", SUPABASE_KEY.length);
console.log("ANON_KEY_START:", SUPABASE_KEY.slice(0, 8));

console.log("URL:", SUPABASE_URL);
console.log("KEY START:", SUPABASE_KEY.slice(0,10));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "ame-auth-token",
  },
});