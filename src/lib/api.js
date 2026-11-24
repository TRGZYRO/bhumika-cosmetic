/**
 * Client-side API helper for Bhumika Cosmetic.
 *
 * Every call attaches the current Firebase ID token (from AuthContext) so the
 * server can verify the caller and resolve their profile via firebase_uid.
 * Frontend code never touches Supabase directly for user-scoped data.
 *
 * Base URL is relative (same origin) so it works on localhost and Vercel.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

let getIdToken = () => Promise.resolve(null);

/** Set by AuthProvider once it has access to getIdToken. */
export function setIdTokenProvider(provider) {
  getIdToken = provider;
}

async function request(path, options = {}) {
  let idToken = await getIdToken();

  // Fallback: if the provider hasn't returned a token yet, try Firebase directly.
  if (!idToken) {
    try {
      const { auth, hasFirebase } = await import("../lib/firebase");
      if (hasFirebase && auth && auth.currentUser) {
        idToken = await auth.currentUser.getIdToken(true);
      } else {
        console.debug("[api] no auth.currentUser — hasFirebase:", hasFirebase, "auth:", !!auth, "currentUser:", auth?.currentUser);
      }
    } catch {
      // ignore — no token available
      console.debug("[api] Firebase fallback threw");
    }
  }

  const headers = {
    "Content-Type": "application/json",
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...options.headers,
  };

  if (!idToken) {
    console.debug("[api] request", path, "— NO idToken attached");
  } else {
    console.debug("[api] request", path, "— idToken attached (len", idToken.length, ")");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Await the body: res.json() returns a Promise, so reading .error
    // without awaiting always fell back to the generic status message.
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new Error(body?.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" }),
};
