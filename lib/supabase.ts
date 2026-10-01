import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

/**
 * Service-role client. Bypasses RLS, so every query through it must be scoped to the
 * authenticated user's id derived from the session - never from client input alone.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
