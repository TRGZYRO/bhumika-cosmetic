/**
 * POST /api/orders
 * Places an order. Prices and stock are checked on the server, never trusted from the browser.
 *
 * Body:
 *   {
 *     items: [{ productId, quantity }],
 *     customer: { name, phone, email, address, pincode, city, state, landmark, latitude, longitude, notes },
 *     paymentMethod: "cod"
 *   }
 *
 * Returns { order: { id, order_number, total_amount, ... } }.
 * Signed-in customers are linked to the order when a valid Firebase token is sent.
 * Guests can check out too. Only the admin client can write orders (RLS), so this route uses it.
 */
import { authenticateRequest, createAdminClient, sendError, sendJson } from "../auth.js";

const MAX_ITEMS = 50;
const MAX_QTY = 20;
const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/;

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function makeOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BC-${stamp}${rand}`;
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

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  const requested = new Map();
  for (const item of rawItems) {
    const productId = clean(item?.productId, 60);
    const quantity = Math.floor(Number(item?.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return sendError(res, 400, "Some items in your cart are invalid. Please review your cart.");
    }
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }
  if (requested.size === 0) return sendError(res, 400, "Your cart is empty.");

  try {
    // Work out who is ordering, if they are signed in. Guests are fine.
    let profileId = null;
    if (req.headers.authorization) {
      const auth = await authenticateRequest(req).catch(() => null);
      if (auth?.ok) profileId = auth.profile.id;
    }

    // Load the live products, prices and stock from the database.
    const ids = [...requested.keys()];
    const { data: products, error: productsErr } = await admin
      .from("products")
      .select("id, name, size_label, base_price, stock_quantity, is_available")
      .in("id", ids);
    if (productsErr) throw productsErr;

    const byId = new Map((products || []).map((p) => [p.id, p]));
    const lines = [];
    for (const [productId, quantity] of requested) {
      const product = byId.get(productId);
      if (!product || !product.is_available) {
        return sendError(res, 409, "An item in your cart is no longer available. Please review your cart.");
      }
      if (product.stock_quantity < quantity) {
        return sendError(
          res,
          409,
          `Only ${product.stock_quantity} left of ${product.name}. Please lower the quantity.`
        );
      }
      const unit = Number(product.base_price);
      lines.push({
        product,
        quantity,
        unit,
        total: unit * quantity,
      });
    }

    // Shop settings decide delivery and tax.
    const { data: settings } = await admin.from("business_settings").select("*").limit(1).maybeSingle();
    const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
    const freeAbove = Number(settings?.free_delivery_above || 0);
    const deliveryCharge =
      subtotal === 0 || (freeAbove > 0 && subtotal >= freeAbove) ? 0 : Number(settings?.delivery_charge ?? 0);
    const taxAmount = Math.round(subtotal * Number(settings?.tax_rate || 0) * 100) / 100;
    const total = Math.round((subtotal + deliveryCharge + taxAmount) * 100) / 100;

    // Reserve stock. Each update is conditional, so a stock check cannot be overtaken by a racing order.
    const reserved = [];
    for (const line of lines) {
      const remaining = line.product.stock_quantity - line.quantity;
      const { data: updated, error: stockErr } = await admin
        .from("products")
        .update({ stock_quantity: remaining, updated_at: new Date().toISOString() })
        .eq("id", line.product.id)
        .eq("stock_quantity", line.product.stock_quantity)
        .select("id")
        .maybeSingle();
      if (stockErr || !updated) {
        // Put back anything already reserved in this order.
        for (const r of reserved) {
          await admin.from("products").update({ stock_quantity: r.previous }).eq("id", r.id);
        }
        return sendError(res, 409, `${line.product.name} just sold out or changed. Please review your cart.`);
      }
      reserved.push({ id: line.product.id, previous: line.product.stock_quantity });
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
        subtotal,
        tax_amount: taxAmount,
        delivery_charge: deliveryCharge,
        discount_amount: 0,
        total_amount: total,
        payment_status: "pending",
        order_status: "pending",
        payment_provider: "cod",
      })
      .select()
      .single();

    if (orderErr) {
      for (const r of reserved) {
        await admin.from("products").update({ stock_quantity: r.previous }).eq("id", r.id);
      }
      throw orderErr;
    }

    const { error: itemsErr } = await admin.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_name: l.product.name,
        variant_name: l.product.size_label || null,
        unit_price: l.unit,
        quantity: l.quantity,
        total_price: l.total,
      }))
    );
    if (itemsErr) throw itemsErr;

    return sendJson(res, 201, {
      order: {
        id: order.id,
        order_number: order.order_number,
        subtotal,
        delivery_charge: deliveryCharge,
        tax_amount: taxAmount,
        total_amount: total,
        payment_method: "cod",
      },
    });
  } catch (err) {
    console.error("Create order error:", err);
    return sendError(res, 500, "We couldn't place your order just now. Please try again.");
  }
}
