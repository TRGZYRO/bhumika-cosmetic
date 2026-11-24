/**
 * Cloudflare Turnstile verification (free bot protection).
 *
 * Active only when TURNSTILE_SECRET_KEY is set on the server. Without it the
 * check is skipped, so the site keeps working until the keys are added.
 * The matching public key is VITE_TURNSTILE_SITE_KEY (browser).
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** @returns {Promise<boolean>} true when the token is valid (or Turnstile is not enabled). */
export async function verifyTurnstile(token, remoteIp) {
  if (!turnstileEnabled()) return true;
  if (!token || typeof token !== "string") return false;

  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return false;
  }
}
