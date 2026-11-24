/**
 * Catch-all API function: GET/POST/PUT/DELETE /api/<name>[/...]
 * Loads and runs the handler registered in server/router.js.
 */
import { ROUTES } from "../server/router.js";

// Route name from the request path, e.g. /api/products?id=1 -> "products".
function nameFromUrl(req) {
  const pathname = (req.url || "").split("?")[0];
  const match = pathname.match(/^\/api\/([^/]+)/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  const route = req.query?.route;
  const name = (Array.isArray(route) ? route[0] : route) || nameFromUrl(req);
  const load = name ? ROUTES[name] : undefined;
  if (!load) return res.status(404).json({ error: "API route not found" });

  try {
    const mod = await load();
    return await mod.default(req, res);
  } catch (err) {
    // Full error goes to Vercel's function logs; the app gets the message as JSON.
    console.error(`API /api/${name} crashed:`, err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Something went wrong on the server. Please try again." });
    }
  }
}
