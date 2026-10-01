import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function resolveCredentials(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return { url, key };
}

/**
 * Service-role client. Bypasses RLS, so every query through it must be scoped to the
 * authenticated user's id derived from the session - never from client input alone.
 *
 * The client is created on first use rather than at import time. Throwing at module scope
 * would fail `next build` whenever the credentials are absent, because the build collects
 * page data and evaluates the auth route handler; deferring the check means a missing
 * variable surfaces on the first real request instead, with an actionable message.
 */
function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    const { url, key } = resolveCredentials();
    cached = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}

export const supabaseAdmin: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, property, receiver) {
      const value = Reflect.get(getSupabaseAdmin(), property, receiver);
      return typeof value === "function" ? value.bind(getSupabaseAdmin()) : value;
    },
  },
);
