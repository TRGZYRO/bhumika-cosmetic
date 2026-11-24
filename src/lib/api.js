/**
 * Client-side API helper for Bhumika Cosmetic.
 *
 * Every call attaches the current Firebase ID token so the server can verify the
 * caller and resolve their profile via firebase_uid. Frontend code never touches
 * Supabase directly for user-scoped data.
 *
 * Tokens are read from Firebase's cache (no forced refresh). Firebase renews an
 * expiring token on its own, so forcing a refresh on every request only added a
 * network round trip to every page.
 *
 * Base URL is relative (same origin) so it works on localhost and Vercel.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

let getIdToken = () => Promise.resolve(null);

/** Set by AuthProvider once it has access to getIdToken. */
export function setIdTokenProvider(provider) {
  getIdToken = provider;
}

/** Resolves to fallback if the promise takes longer than ms (so a stalled call cannot hang the UI). */
function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function resolveIdToken() {
  // Never let a slow token lookup block the request for long. Without a token the
  // request still goes out, and the server treats it as a guest.
  const fromProvider = await withTimeout(Promise.resolve().then(getIdToken), 5000, null);
  if (fromProvider) return fromProvider;

  // Fallback: the provider has not been registered yet. Read Firebase directly.
  try {
    const { auth, hasFirebase } = await import("../lib/firebase");
    if (hasFirebase && auth?.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch {
    /* no token available: the request goes out unauthenticated */
  }
  return null;
}

async function request(path, options = {}) {
  const { timeoutMs = 30000, timeoutMessage, ...fetchOptions } = options;
  const idToken = await resolveIdToken();

  const headers = {
    "Content-Type": "application/json",
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...fetchOptions.headers,
  };

  // Give up on a request that never answers, so the shopper is not stuck on a spinner.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(timeoutMessage || "The request took too long. Please check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
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
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" }),
};
