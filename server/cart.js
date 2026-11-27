/**
 * Server-side cart helpers. The browser only sends product ids and quantities.
 * Prices, combos and stock are always read from the database here.
 */
import { linePricing, normalizeCombo } from "../shared/pricing.js";

export const MAX_ITEMS = 50;
export const MAX_QTY = 20;

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/**
 * Checks the items sent by the browser and merges duplicates.
 * Returns { ok: true, requested: Map<productId, quantity> } or { ok: false, error }.
 */
export function parseRequestedItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems.slice(0, MAX_ITEMS) : [];
  const requested = new Map();
  for (const item of items) {
    const productId = clean(item?.productId, 60);
    const quantity = Math.floor(Number(item?.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return { ok: false, error: "Some items in your cart are invalid. Please review your cart." };
    }
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }
  if (requested.size === 0) return { ok: false, error: "Your cart is empty." };
  return { ok: true, requested };
}

/**
 * Loads the products in `requested` and prices each line with combos applied.
 * Returns { ok: true, lines, subtotal } or { ok: false, status, error }.
 * A line has: product (database row), quantity, unit, combo, pricing, total.
 */
export async function priceLines(admin, requested) {
  const ids = [...requested.keys()];
  const { data: products, error } = await admin
    .from("products")
    .select("id, name, size_label, base_price, combo_quantity, combo_price, stock_quantity, is_available")
    .in("id", ids);
  if (error) throw error;

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const lines = [];
  for (const [productId, quantity] of requested) {
    const product = byId.get(productId);
    if (!product || !product.is_available) {
      return { ok: false, status: 409, error: "An item in your cart is no longer available. Please review your cart." };
    }
    const unit = Number(product.base_price);
    const combo = normalizeCombo(product.combo_quantity, product.combo_price, unit);
    const pricing = linePricing({ quantity, unitPrice: unit, combo });
    lines.push({ product, quantity, unit, combo, pricing, total: pricing.total });
  }
  const subtotal = Math.round(lines.reduce((sum, l) => sum + l.total, 0) * 100) / 100;
  return { ok: true, lines, subtotal };
}
