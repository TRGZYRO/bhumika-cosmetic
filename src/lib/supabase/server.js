/**
 * Server-only Supabase helpers.
 *
 * Bhumika Cosmetic is a Vite single-page app deployed to Vercel. Server code runs
 * in the serverless functions under /api (Node.js). This module must NEVER be
 * imported from browser code, because it reads the service-role key.
 *
 * It intentionally does not use Next.js APIs such as next/headers: this app
 * has no Next.js runtime. Auth is passed as a bearer token from the client.
 */
import { createClient } from "@supabase/supabase-js";

const url = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

/** Privileged client (bypasses RLS). Use only for trusted server-side checks. */
export function createAdminClient() {
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Client that acts as the signed-in user, so RLS policies apply.
 * @param {string} accessToken Supabase access token from the request's Authorization header
 */
export function createUserClient(accessToken) {
  return createClient(url(), process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
