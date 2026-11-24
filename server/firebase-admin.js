/**
 * Firebase ID token verification (server-only).
 *
 * Verifies a Firebase ID token by asking Google's Identity Toolkit to look it up
 * with the project's Web API key. Google checks the token's signature, expiry and
 * project, and returns the user it belongs to.
 *
 * Verified results are cached in memory for a few minutes. On a warm serverless
 * instance this skips a network round trip to Google on every API call.
 *
 * NEVER import this from browser code.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const tokenCache = new Map();

function webApiKey() {
  return process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
}

/** True when the Firebase Web API key is available to the server. */
export function isAdminConfigured() {
  return Boolean(webApiKey());
}

/**
 * Verify a Firebase ID token. Returns { uid, email, name, emailVerified },
 * or null if Google rejects the token or the check fails.
 */
export async function verifyIdToken(idToken) {
  if (!idToken) return null;

  const cached = tokenCache.get(idToken);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const apiKey = webApiKey();
  if (!apiKey) {
    console.warn("Firebase ID token check skipped: FIREBASE_API_KEY / VITE_FIREBASE_API_KEY is not set.");
    return null;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        // Do not let a slow Google call hold the whole request open.
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await response.json().catch(() => ({}));
    const user = Array.isArray(data.users) ? data.users[0] : null;

    if (!response.ok || !user || !user.localId) {
      console.warn("Firebase ID token rejected:", data?.error?.message || `HTTP ${response.status}`);
      return null;
    }

    const verified = {
      uid: user.localId,
      email: user.email || "",
      name: user.displayName || "",
      emailVerified: Boolean(user.emailVerified),
    };

    if (tokenCache.size >= CACHE_MAX_ENTRIES) tokenCache.clear();
    tokenCache.set(idToken, { user: verified, expiresAt: Date.now() + CACHE_TTL_MS });

    return verified;
  } catch (err) {
    console.warn("Firebase ID token check failed:", err?.message || err);
    return null;
  }
}
