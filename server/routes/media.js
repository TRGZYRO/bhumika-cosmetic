import { authenticateRequest, sendError, sendJson } from "../auth.js";

/**
 * Image uploads for the menu, stored in Supabase Storage (free tier, same project).
 *   GET    /api/media              list images
 *   POST   /api/media              { filename, contentType, data (base64) } -> { url, name }
 *   DELETE /api/media?name=<name>  remove an image
 * Admin only. Vercel limits request bodies to about 4.5 MB, so files are capped at 3 MB.
 */
const BUCKET = "menu-images";
const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth.ok) return sendError(res, auth.status, auth.error);
  if (!auth.isAdmin) return sendError(res, 403, "Admin access required");

  const storage = auth.supabase.storage.from(BUCKET);
  const publicUrl = (name) => storage.getPublicUrl(name).data.publicUrl;

  try {
    if (req.method === "GET") {
      const { data, error } = await auth.supabase.storage.from(BUCKET).list("", {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      const images = (data || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => ({ name: f.name, url: publicUrl(f.name), created_at: f.created_at }));
      return sendJson(res, 200, { images });
    }

    if (req.method === "POST") {
      const { filename = "image", contentType, data } = req.body || {};
      const ext = ALLOWED[contentType];
      if (!ext) return sendError(res, 400, "Upload a JPG, PNG, WebP or GIF image.");
      if (typeof data !== "string" || !data) return sendError(res, 400, "No image data received.");

      const buffer = Buffer.from(data, "base64");
      if (buffer.length === 0) return sendError(res, 400, "Image data is empty.");
      if (buffer.length > MAX_BYTES) return sendError(res, 413, "Image is too large. Please use a file under 3 MB.");

      const base = String(filename).replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "image";
      const name = `${Date.now()}-${base}.${ext}`;
      const { error } = await storage.upload(name, buffer, { contentType, upsert: false });
      if (error) throw error;
      return sendJson(res, 201, { name, url: publicUrl(name) });
    }

    if (req.method === "DELETE") {
      const name = new URL(req.url, "http://localhost").searchParams.get("name");
      if (!name || name.includes("/")) return sendError(res, 400, "Image name is required.");
      const { error } = await storage.remove([name]);
      if (error) throw error;
      return sendJson(res, 200, { ok: true });
    }

    return sendError(res, 405, "Method not allowed");
  } catch (err) {
    console.error("Media error:", req.method, err);
    return sendError(res, 500, err.message || "Image request failed.");
  }
}
