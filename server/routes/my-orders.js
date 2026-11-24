import { authenticateRequest, sendError, sendJson } from "../auth.js";

/**
 * GET /api/my-orders
 * Returns the signed-in customer's own orders, newest first, for order tracking.
 * Only orders linked to the caller's profile are returned.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return sendError(res, 405, "Method not allowed");

  const auth = await authenticateRequest(req);
  if (!auth.ok) return sendError(res, auth.status, auth.error);

  try {
    const { data, error } = await auth.supabase
      .from("orders")
      .select("id, order_number, order_status, payment_status, total_amount, created_at, order_items(product_name, quantity)")
      .eq("user_id", auth.profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return sendJson(res, 200, { orders: data || [] });
  } catch (err) {
    console.error("My orders error:", err);
    return sendError(res, 500, "Could not load your orders.");
  }
}
