/**
 * GET/POST/PUT/DELETE /api/addresses
 * Saved delivery addresses for the signed-in customer.
 *
 * The caller is resolved from the verified Firebase ID token, so user_id is always
 * the profile id (a Firebase UID, stored as text). Never a uuid.
 */
import { authenticateRequest, sendError, sendJson } from "../auth.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/;
const PINCODE_PATTERN = /^[0-9]{6}$/;

function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/** Returns null when empty, NaN when out of range, otherwise the number. */
function coord(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
}

function readFields(body) {
  return {
    label: text(body.label, 30) || "Home",
    full_name: text(body.full_name, 80),
    phone: text(body.phone, 20),
    address_line1: text(body.address_line1, 200),
    address_line2: text(body.address_line2, 200) || null,
    city: text(body.city, 80),
    state: text(body.state, 80),
    pincode: text(body.pincode, 10),
    landmark: text(body.landmark, 150) || null,
    latitude: coord(body.latitude, -90, 90),
    longitude: coord(body.longitude, -180, 180),
    is_default: Boolean(body.is_default),
  };
}

function validate(f) {
  if (!f.full_name || !f.phone || !f.address_line1 || !f.city || !f.state || !f.pincode) {
    return "Missing required address fields.";
  }
  if (!PHONE_PATTERN.test(f.phone)) return "Enter a valid phone number.";
  if (!PINCODE_PATTERN.test(f.pincode)) return "Pincode should be 6 digits.";
  if (Number.isNaN(f.latitude) || Number.isNaN(f.longitude)) return "Invalid map location.";
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth.ok) return sendError(res, auth.status, auth.error);

  const db = auth.supabase;
  const userId = auth.profile.id;

  try {
    if (req.method === "GET") {
      const { data, error } = await db
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return sendJson(res, 200, { addresses: data || [] });
    }

    if (req.method === "POST") {
      const fields = readFields(req.body || {});
      const problem = validate(fields);
      if (problem) return sendError(res, 400, problem);

      if (fields.is_default) {
        await db.from("addresses").update({ is_default: false }).eq("user_id", userId);
      }

      const { data, error } = await db
        .from("addresses")
        .insert({ ...fields, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return sendJson(res, 201, { address: data });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const id = String(body.id || "");
      if (!UUID_PATTERN.test(id)) return sendError(res, 400, "Invalid address ID.");

      const fields = readFields(body);
      const problem = validate(fields);
      if (problem) return sendError(res, 400, problem);

      if (fields.is_default) {
        await db.from("addresses").update({ is_default: false }).eq("user_id", userId).neq("id", id);
      }

      const { data, error } = await db
        .from("addresses")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendError(res, 404, "Address not found.");
      return sendJson(res, 200, { address: data });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!UUID_PATTERN.test(id)) return sendError(res, 400, "Invalid address ID.");

      const { error } = await db.from("addresses").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return sendJson(res, 200, { success: true });
    }

    return sendError(res, 405, "Method not allowed");
  } catch (err) {
    console.error("Addresses API error:", err);
    return sendError(res, 500, "We couldn't save your address right now. Please try again.");
  }
}
