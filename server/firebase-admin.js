/**
 * Firebase ID token verification (server-only).
 *
 * Verifies a Firebase ID token by asking Google's Identity Toolkit to look it up
 * with the project's Web API key. Google checks the token's signature, expiry and
 * project, and returns the user it belongs to.
 *
 * This avoids the Firebase Admin SDK, whose token checks depend on an ES-module-only
 * package that fails to load in Vercel's serverless runtime ("require() of ES Module").
 *
 * Uses the same API key the website already has (VITE_FIREBASE_API_KEY), so no
 * private key is needed on the server.
 *
 * NEVER import this from browser code.
 */

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
      }
    );
    const data = await response.json().catch(() => ({}));
    const user = Array.isArray(data.users) ? data.users[0] : null;

    if (!response.ok || !user || !user.localId) {
      console.warn("Firebase ID token rejected:", data?.error?.message || `HTTP ${response.status}`);
      return null;
    }

    return {
      uid: user.localId,
      email: user.email || "",
      name: user.displayName || "",
      emailVerified: Boolean(user.emailVerified),
    };
  } catch (err) {
    console.warn("Firebase ID token check failed:", err?.message || err);
    return null;
  }
}
