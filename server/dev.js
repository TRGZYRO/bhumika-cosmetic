/**
 * Local dev server for Bhumika Cosmetic.
 *
 * Runs Vite for the frontend and executes /api/* route handlers (Vercel-style
 * serverless functions) via an Express server, so the dev environment matches
 * production behavior.
 */
// MUST stay first: loads .env.local before the API handlers below are evaluated.
import "./load-env.js";

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "node:path";

import { ROUTES as HANDLERS } from "./router.js";
import { isAdminConfigured } from "./firebase-admin.js";

const root = path.resolve(process.cwd());

async function main() {
  const app = express();
  app.use(express.json());

  // --- /api/* routes: execute the Vercel-style handler modules ---
  app.use("/api", async (req, res) => {
    const pathOnly = req.originalUrl.split("?")[0];
    const segments = pathOnly.split("/").filter(Boolean); // ['api', 'admin-data', ...rest]
    const name = segments[1];
    if (!name) {
      return res.status(404).json({ error: "API route not found" });
    }
    const load = HANDLERS[name];
    if (!load) {
      return res.status(404).json({ error: "API route not found" });
    }
    try {
      const mod = await load();
      await mod.default(req, res);
    } catch (err) {
      console.error(`API /api/${name} error:`, err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // --- Vite middleware for the frontend ---
  const vite = await createViteServer({
    root,
    server: {
      middlewareMode: true,
    },
  });
  app.use(vite.middlewares);

  const PORT = process.env.PORT || 5175;
  console.log(
    `Firebase Admin: ${isAdminConfigured() ? "configured" : "NOT configured (check VITE_FIREBASE_API_KEY in .env.local)"}`
  );
  console.log(
    `Supabase URL: ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ? "set" : "MISSING"}`
  );
  app.listen(PORT, () => {
    console.log(`Bhumika Cosmetic dev server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});
