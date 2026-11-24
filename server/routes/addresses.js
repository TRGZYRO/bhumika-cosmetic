/**
 * GET/POST/PUT/DELETE /api/addresses
 * Manage saved delivery addresses for the authenticated user.
 * Verifies the Firebase ID token and resolves the profile via firebase_uid.
 */
import { authenticateRequest, sendError, sendJson } from "../auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth.ok) return sendError(res, auth.status, auth.error);

  const userId = auth.profile.id;

  if (req.method === "GET") {
    const { data, error } = await auth.supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return sendJson(res, 200, { addresses: data || [] });
  }

  if (req.method === "POST") {
    const { label, full_name, phone, address_line1, address_line2, city, state, pincode, landmark, latitude, longitude, is_default } = req.body || {};

    if (!label || !full_name || !phone || !address_line1 || !city || !state || !pincode) {
      return sendError(res, 400, "Missing required address fields.");
    }

    // If this is default, unset others
    if (is_default) {
      await auth.supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    }

    const { data, error } = await auth.supabase
      .from("addresses")
      .insert({
        user_id: userId,
        label,
        full_name,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        landmark,
        latitude,
        longitude,
        is_default: !!is_default
      })
      .select()
      .single();

    if (error) throw error;
    return sendJson(res, 201, { address: data });
  }

  if (req.method === "PUT") {
    const { id, label, full_name, phone, address_line1, address_line2, city, state, pincode, landmark, latitude, longitude, is_default } = req.body || {};

    if (!id) return sendError(res, 400, "Address ID is required.");

    // If this is default, unset others
    if (is_default) {
      await auth.supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    }

    const { data, error } = await auth.supabase
      .from("addresses")
      .update({
        label,
        full_name,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        landmark,
        latitude,
        longitude,
        is_default: !!is_default,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return sendError(res, 404, "Address not found.");
    return sendJson(res, 200, { address: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query || {};
    if (!id) return sendError(res, 400, "Address ID is required.");

    const { error } = await auth.supabase
      .from("addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return sendJson(res, 200, { success: true });
  }

  return sendError(res, 405, "Method not allowed");
}