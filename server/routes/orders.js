/**
 * POST /api/orders
 * Places an order. Prices, combo offers, coupons and stock are checked on the server,
 * never trusted from the browser.
 *
 * Body:
 *   {
 *     items: [{ productId, quantity }],
 *     customer: { name, phone, email, address, pincode, city, state, landmark, latitude, longitude, notes },
 *     paymentMethod: "cod",
 *     couponCode?: "SAVE10"
 *   }
 *
 * Returns { order: { id, order_number, subtotal, discount, coupon_code, total_amount, ... } }.
 * Signed-in customers are linked to the order when a valid Firebase token is sent.
 * Guests can check out too. Only the admin client can write orders (RLS), so this route uses it.
 */
import { authenticateRequest, createAdminClient, sendError, sendJson } from "../auth.js";
import { parseRequestedItems, priceLines } from "../cart.js";
import { checkCoupon, normalizeCouponCode, orderTotals } from "../../shared/pricing.js";

const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/;

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/** Last 10 digits of a phone number, so +91 98765 43210 and 9876543210 match. */
function phoneKey(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.slice(-10);
}

/**
 * How many times this customer has already used the coupon. Counts their non-cancelled orders,
 * matched by signed-in account or, for guests, by phone number.
 */
async function customerCouponUses(admin, code, profileId, phone) {
  const { data, error } = await admin
    .from("orders")
    .select("user_id, customer_phone")
    .eq("coupon_code", code)
    .neq("order_status", "cancelled");
  if (error) throw error;
  const me = phoneKey(phone);
  return (data || []).filter(
    (o) => (profileId && o.user_id === profileId) || (me && phoneKey(o.customer_phone) === me)
  ).length;
}

function makeOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BC-${stamp}${rand}`;
}

/** Put reserved stock back, in parallel. Used when an order cannot be completed. */
async function restoreStock(admin, reserved) {
  await Promise.all(
    reserved.map((r) => admin.from("products").update({ stock_quantity: r.previous }).eq("id", r.id))
  );
}

/**
 * Counts one use of a coupon. The update only succeeds if the count is still the value we
 * read, so two orders racing for the last use cannot both get it.
 */
async function claimCoupon(admin, coupon) {
  const { data, error } = await admin
    .from("coupons")
    .update({ times_used: coupon.times_used + 1, updated_at: new Date().toISOString() })
    .eq("id", coupon.id)
    .eq("times_used", coupon.times_used)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}

/** Gives back a coupon use that was claimed for an order that could not be completed. */
async function releaseCoupon(admin, coupon) {
  await admin
    .from("coupons")
    .update({ times_used: coupon.times_used, updated_at: new Date().toISOString() })
    .eq("id", coupon.id)
    .eq("times_used", coupon.times_used + 1);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendError(res, 405, "Method not allowed");

  const admin = createAdminClient();
  if (!admin) return sendError(res, 500, "Server is not configured for orders yet.");

  const body = req.body || {};
  const customer = body.customer || {};
  const name = clean(customer.name, 80);
  const phone = clean(customer.phone, 20);
  const email = clean(customer.email, 120);
  const address = clean(customer.address, 300);
  const pincode = clean(customer.pincode, 10);
  const city = clean(customer.city, 80);
  const state = clean(customer.state, 80);
  const landmark = clean(customer.landmark, 150);
  const latitude = customer.latitude ? Number(customer.latitude) : null;
  const longitude = customer.longitude ? Number(customer.longitude) : null;
  const notes = clean(customer.notes, 300);

  if (!name) return sendError(res, 400, "Please enter your name.");
  if (!PHONE_PATTERN.test(phone)) return sendError(res, 400, "Please enter a valid phone number.");
  if (address.length < 10) return sendError(res, 400, "Please enter your full delivery address.");
  if (!city) return sendError(res, 400, "Please enter your city.");
  if (!state) return sendError(res, 400, "Please enter your state.");
  if (pincode && !/^[0-9]{6}$/.test(pincode)) return sendError(res, 400, "Pincode should be 6 digits.");
  if (latitude !== null && (latitude < -90 || latitude > 90)) return sendError(res, 400, "Invalid latitude.");
  if (longitude !== null && (longitude < -180 || longitude > 180)) return sendError(res, 400, "Invalid longitude.");

  const parsed = parseRequestedItems(body.items);
  if (!parsed.ok) return sendError(res, 400, parsed.error);
  const { requested } = parsed;
  const couponCode = normalizeCouponCode(body.couponCode);

  try {
    // These lookups do not depend on each other, so they run at the same time:
    // who is ordering (if signed in), live prices and combos, shop settings, and the coupon.
    const [auth, priced, settingsRes, couponRes] = await Promise.all([
      req.headers.authorization ? authenticateRequest(req).catch(() => null) : null,
      priceLines(admin, requested),
      admin.from("business_settings").select("*").limit(1).maybeSingle(),
      couponCode
        ? admin.from("coupons").select("*").eq("code", couponCode).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const profileId = auth?.ok ? auth.profile.id : null;
    if (!priced.ok) return sendError(res, priced.status, priced.error);
    if (settingsRes.error) throw settingsRes.error;
    if (couponRes.error) throw couponRes.error;

    const { lines, subtotal } = priced;
    for (const line of lines) {
      if (line.product.stock_quantity < line.quantity) {
        return sendError(
          res,
          409,
          `Only ${line.product.stock_quantity} left of ${line.product.name}. Please lower the quantity.`
        );
      }
    }

    // Coupon: checked against the subtotal after combos.
    let coupon = null;
    let couponDiscount = 0;
    if (couponCode) {
      if (!couponRes.data) return sendError(res, 400, "This coupon code is not valid.");
      const check = checkCoupon(couponRes.data, subtotal);
      if (!check.ok) return sendError(res, 400, check.message);
      const perCustomer = couponRes.data.per_customer_limit;
      if (perCustomer !== null && perCustomer !== undefined) {
        const uses = await customerCouponUses(admin, couponCode, profileId, phone);
        if (uses >= Number(perCustomer)) {
          return sendError(
            res,
            400,
            Number(perCustomer) === 1
              ? "You have already used this coupon."
              : `You have already used this coupon the maximum ${perCustomer} times.`
          );
        }
      }
      coupon = couponRes.data;
      couponDiscount = check.discount;
    }

    const settings = settingsRes.data;
    const totals = orderTotals({
      subtotal,
      discount: couponDiscount,
      shop: {
        deliveryCharge: Number(settings?.delivery_charge ?? 0),
        freeDeliveryAbove: Number(settings?.free_delivery_above || 0),
        taxRate: Number(settings?.tax_rate || 0),
      },
    });

    // Reserve stock for every line at once. Each update is conditional on the stock we
    // just read, so a racing order cannot oversell.
    const reservations = await Promise.all(
      lines.map((line) =>
        admin
          .from("products")
          .update({
            stock_quantity: line.product.stock_quantity - line.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", line.product.id)
          .eq("stock_quantity", line.product.stock_quantity)
          .select("id")
          .maybeSingle()
          .then(({ data, error }) => ({ line, ok: !error && Boolean(data) }))
      )
    );
    const reserved = reservations
      .filter((r) => r.ok)
      .map((r) => ({ id: r.line.product.id, previous: r.line.product.stock_quantity }));
    const failed = reservations.find((r) => !r.ok);
    if (failed) {
      await restoreStock(admin, reserved);
      return sendError(res, 409, `${failed.line.product.name} just sold out or changed. Please review your cart.`);
    }

    // Count the coupon use now that stock is held. If another order used the last
    // use first, give the stock back and ask the shopper to remove the coupon.
    let couponClaimed = false;
    if (coupon) {
      couponClaimed = await claimCoupon(admin, coupon);
      if (!couponClaimed) {
        await restoreStock(admin, reserved);
        return sendError(res, 409, "This coupon has just been used up. Please remove it and try again.");
      }
    }

    const orderNumber = makeOrderNumber();
    const fullAddress = [address, city, state, pincode].filter(Boolean).join(", ");
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: profileId,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        fulfilment_method: "delivery",
        delivery_address: fullAddress,
        delivery_city: city || null,
        delivery_state: state || null,
        delivery_landmark: landmark || null,
        delivery_latitude: latitude,
        delivery_longitude: longitude,
        special_instructions: notes || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        delivery_charge: totals.deliveryCharge,
        discount_amount: totals.discount,
        coupon_code: coupon ? coupon.code : null,
        total_amount: totals.total,
        payment_status: "pending",
        order_status: "pending",
        payment_provider: "cod",
      })
      .select()
      .single();

    if (orderErr) {
      await restoreStock(admin, reserved);
      if (couponClaimed) await releaseCoupon(admin, coupon);
      throw orderErr;
    }

    const { error: itemsErr } = await admin.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_name: l.product.name,
        // Keeps the size and, when a combo applied, the combo deal visible to staff.
        variant_name:
          [l.product.size_label, l.pricing.bundles > 0 ? `Combo ${l.combo.quantity} for ₹${l.combo.price}` : null]
            .filter(Boolean)
            .join(" · ") || null,
        unit_price: l.unit,
        quantity: l.quantity,
        total_price: l.total,
      }))
    );
    if (itemsErr) {
      // Do not leave a half-saved order (no items), stock held, or a coupon use counted for it.
      await admin.from("orders").delete().eq("id", order.id);
      await restoreStock(admin, reserved);
      if (couponClaimed) await releaseCoupon(admin, coupon);
      throw itemsErr;
    }

    return sendJson(res, 201, {
      order: {
        id: order.id,
        order_number: order.order_number,
        subtotal: totals.subtotal,
        discount: totals.discount,
        coupon_code: order.coupon_code,
        delivery_charge: totals.deliveryCharge,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        payment_method: "cod",
      },
    });
  } catch (err) {
    console.error("Create order error:", err);
    return sendError(res, 500, "We couldn't place your order just now. Please try again.");
  }
}
