/**
 * GET/PUT /api/profile
 * Get or update the authenticated user's profile.
 * Verifies the Firebase ID token and resolves the profile via firebase_uid.
 *
 * GET returns: { profile, roles, addresses }
 * PUT body may include: full_name, phone, email, address, username, addresses.
 * username: 3-20 chars, letters/digits/underscore, stored lowercase, unique.
 * addresses: array of address objects to save/update
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
    // Fetch saved addresses
    const { data: addresses, error: addrError } = await auth.supabase
      .from("addresses")
      .select("*")
      .eq("user_id", auth.profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    return sendJson(res, 200, {
      profile: auth.profile,
      roles: auth.roles,
      addresses: addresses || []
    });
  }

  if (req.method === "PUT") {
    const { full_name, phone, email, address, username, addresses } = req.body || {};
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

    // Update profile
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

    // Handle addresses if provided
    let savedAddresses = [];
    if (Array.isArray(addresses)) {
      for (const addr of addresses) {
        const { id, label, full_name: addrName, phone: addrPhone, address_line1, address_line2, city, state, pincode, landmark, latitude, longitude, is_default } = addr;

        if (id) {
          // Update existing
          const { data: updated, error: updError } = await auth.supabase
            .from("addresses")
            .update({
              label,
              full_name: addrName,
              phone: addrPhone,
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
            .eq("user_id", auth.profile.id)
            .select()
            .single();
          if (!updError && updated) savedAddresses.push(updated);
        } else {
          // Insert new
          const { data: inserted, error: insError } = await auth.supabase
            .from("addresses")
            .insert({
              user_id: auth.profile.id,
              label: label || 'Home',
              full_name: addrName,
              phone: addrPhone,
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
          if (!insError && inserted) savedAddresses.push(inserted);
        }
      }
    }

    return sendJson(res, 200, { profile: data, addresses: savedAddresses });
  }

  return sendError(res, 405, "Method not allowed");
}
