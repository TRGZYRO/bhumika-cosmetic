/**
 * POST /api/coupons
 * Checks a coupon code against the current cart. Nothing is saved here: the order route
 * checks and counts the coupon again when the order is placed.
 *
 * Body: { code: "SAVE10", items: [{ productId, quantity }] }
 * Returns: { coupon: { code, description, discount_type, discount_value, min_order_amount,
 *            max_discount_amount }, subtotal, discount }
 * Errors: 400 with a message the shopper can act on (expired, below minimum, and so on).
 */
import { createAdminClient, sendError, sendJson } from "../auth.js";
import { parseRequestedItems, priceLines } from "../cart.js";
import { checkCoupon, normalizeCouponCode } from "../../shared/pricing.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendError(res, 405, "Method not allowed");

  const admin = createAdminClient();
  if (!admin) return sendError(res, 500, "Coupons are not available right now.");

  const body = req.body || {};
  const code = normalizeCouponCode(body.code);
  if (!code) return sendError(res, 400, "Enter a coupon code.");

  const parsed = parseRequestedItems(body.items);
  if (!parsed.ok) return sendError(res, 400, parsed.error);

  try {
    const [priced, couponRes] = await Promise.all([
      priceLines(admin, parsed.requested),
      admin.from("coupons").select("*").eq("code", code).maybeSingle(),
    ]);
    if (!priced.ok) return sendError(res, priced.status, priced.error);
    if (couponRes.error) throw couponRes.error;
    if (!couponRes.data) return sendError(res, 400, "This coupon code is not valid.");

    const check = checkCoupon(couponRes.data, priced.subtotal);
    if (!check.ok) return sendError(res, 400, check.message);

    const c = couponRes.data;
    return sendJson(res, 200, {
      coupon: {
        code: c.code,
        description: c.description || "",
        discount_type: c.discount_type,
        discount_value: Number(c.discount_value),
        min_order_amount: Number(c.min_order_amount || 0),
        max_discount_amount: c.max_discount_amount === null ? null : Number(c.max_discount_amount),
      },
      subtotal: priced.subtotal,
      discount: check.discount,
    });
  } catch (err) {
    console.error("Coupon check error:", err);
    return sendError(res, 500, "We couldn't check this coupon just now. Please try again.");
  }
}
