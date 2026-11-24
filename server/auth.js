/**
 * Server-side auth helpers for RaunaQ House API routes.
 *
 * Firebase replaces Supabase Authentication only. Every API route that touches
 * user-scoped data verifies the Firebase ID token (Authorization: Bearer <idToken>)
 * sent by the client, then resolves the Supabase profile via `firebase_uid`.
 * Frontend-supplied user IDs are never trusted.
 *
 * Required server env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { verifyIdToken, isAdminConfigured } from "./firebase-admin.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Email granted admin access server-side. Must match ADMIN_EMAIL in AuthContext.
const ADMIN_EMAIL = "utkarshavasthi001@gmail.com";

/** Privileged Supabase client (bypasses RLS). Server-only. */
export function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Verify the Firebase ID token from the request and resolve the caller's
 * Supabase profile + roles.
 *
 * Returns { ok: true, profile, roles, firebaseUid } or
 *        { ok: false, status, error }.
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  const idToken = authHeader.slice(7);

  const decoded = await verifyIdToken(idToken);
  if (!decoded) {
    if (!isAdminConfigured()) {
      return {
        ok: false,
        status: 500,
        error:
          "Server is missing VITE_FIREBASE_API_KEY (or FIREBASE_API_KEY) in Vercel environment variables.",
      };
    }
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }

  const firebaseUid = decoded.uid;

  const supabase = createAdminClient();
  if (!supabase) {
    return { ok: false, status: 500, error: "Server is not configured" };
  }

  // Resolve profile via Firebase UID — never trust frontend-supplied IDs.
  let { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("firebase_uid", firebaseUid)
    .single();

  // Auto-create a profile if none exists for this Firebase UID. This ensures
  // Firebase users can book reservations even if signup profile creation failed
  // or the user signed up before the firebase_uid column existed. Never trusts
  // frontend-supplied IDs — the profile is keyed by the verified Firebase UID.
  if (error || !profile) {
    const { data: created, error: createErr } = await supabase
      .from("profiles")
      .insert({
        id: firebaseUid,
        full_name: decoded.name || "",
        email: decoded.email || "",
        firebase_uid: firebaseUid,
        role: "customer",
      })
      .select()
      .single();

    if (createErr || !created) {
      return { ok: false, status: 401, error: "Account not found" };
    }
    profile = created;
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", profile.id);
  const roleList = (roles || []).map((x) => x.role);

  // The admin email grants admin access only when Firebase has verified that the
  // email belongs to the caller. Without this check, anyone could register an
  // unverified account with that address and become an admin.
  const isVerifiedAdminEmail = decoded.email === ADMIN_EMAIL && decoded.emailVerified === true;
  if (isVerifiedAdminEmail && !roleList.length) {
    roleList.push("owner", "manager", "staff");
  }

  return {
    ok: true,
    profile,
    roles: roleList,
    firebaseUid,
    isAdmin: roleList.includes("owner") || roleList.includes("manager"),
    isStaff:
      roleList.includes("owner") ||
      roleList.includes("manager") ||
      roleList.includes("staff"),
    supabase,
  };
}

/** Send a JSON error response. */
export function sendError(res, status, error) {
  return res.status(status).json({ error });
}

/** Send a JSON success response. */
export function sendJson(res, status, body) {
  return res.status(status).json(body);
}
