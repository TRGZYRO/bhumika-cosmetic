/**
 * GET/PUT /api/profile
 * Get or update the authenticated user's profile.
 * Verifies the Firebase ID token and resolves the profile via firebase_uid.
 *
 * PUT body may include: full_name, phone, email, address, username.
 * username: 3-20 chars, letters/digits/underscore, stored lowercase, unique.
 */
import { authenticateRequest, sendError, sendJson } from "../auth.js";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth.ok) return sendError(res, auth.status, auth.error);

  if (req.method === "GET") {
    return sendJson(res, 200, { profile: auth.profile, roles: auth.roles });
  }

  if (req.method === "PUT") {
    const { full_name, phone, email, address, username } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = String(address).slice(0, 300);

    if (username !== undefined) {
      const clean = String(username).trim().toLowerCase();
      if (!USERNAME_PATTERN.test(clean)) {
        return sendError(
          res,
          400,
          "Username must be 3-20 characters and use only letters, numbers, or underscores."
        );
      }
      const { data: taken } = await auth.supabase
        .from("profiles")
        .select("id")
        .eq("username", clean)
        .neq("id", auth.profile.id)
        .maybeSingle();
      if (taken) return sendError(res, 409, "That username is already taken. Please choose another.");
      updates.username = clean;
    }

    const { data, error } = await auth.supabase
      .from("profiles")
      .update(updates)
      .eq("id", auth.profile.id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return sendError(res, 409, "That username is already taken. Please choose another.");
      }
      return sendError(res, 500, error.message);
    }
    return sendJson(res, 200, { profile: data });
  }

  return sendError(res, 405, "Method not allowed");
}
