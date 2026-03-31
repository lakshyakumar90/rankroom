import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

/**
 * Anon-key client for user-facing auth operations.
 * Use this to call signInWithPassword, refreshSession, etc.
 * DO NOT use the service role client for these — it bypasses RLS and is
 * semantically wrong for user auth.
 */
export const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
