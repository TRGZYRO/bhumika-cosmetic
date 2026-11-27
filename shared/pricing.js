/**
 * Pricing rules shared by the storefront (what the shopper sees) and the server
 * (what is actually charged). The server runs these rules again when an order is
 * placed, so nothing about prices or discounts is trusted from the browser.
 *
 * Order of calculation:
 *   1. Each product line: combo offers first (e.g. 2 for ₹199), single price for the rest.
 *   2. Subtotal = sum of the lines (after combos).
 *   3. Coupon discount is taken from the subtotal.
 *   4. Delivery (free above a threshold) and tax are worked out on the amount left to pay.
 */

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Turns the admin's combo fields into a usable combo, or null when there is no valid combo.
 * A combo needs at least 2 pieces and must cost less than buying those pieces one by one,
 * otherwise it would charge the shopper more and is ignored.
 */
export function normalizeCombo(comboQuantity, comboPrice, unitPrice) {
  if (comboQuantity === null || comboQuantity === undefined || comboQuantity === "") return null;
  if (comboPrice === null || comboPrice === undefined || comboPrice === "") return null;
  const quantity = Math.floor(Number(comboQuantity));
  const price = Number(comboPrice);
  const unit = Number(unitPrice);
  if (!Number.isFinite(quantity) || quantity < 2) return null;
  if (!Number.isFinite(price) || price < 0) return null;
  if (!Number.isFinite(unit) || !(price < unit * quantity)) return null;
  return { quantity, price: round2(price) };
}

/**
 * Price for `quantity` pieces of one product. Combos are applied as many times as they fit,
 * and any leftover pieces are charged at the single price.
 *
 * Totals returned:
 *   total      what the shopper pays
 *   mrpTotal   MRP × quantity (the crossed-out amount). Falls back to the selling price when there is no MRP.
 *   sellTotal  selling price × quantity (before combos)
 *   savings    sellTotal − total: the saving from the combo deal
 */
export function linePricing({ quantity, unitPrice, mrp, combo }) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const unit = Number(unitPrice) || 0;
  const mrpUnit = Number(mrp) > unit ? Number(mrp) : unit;
  const bundleSize = combo ? combo.quantity : 0;
  const bundles = combo ? Math.floor(qty / bundleSize) : 0;
  const singles = qty - bundles * bundleSize;
  const total = round2(bundles * (combo ? combo.price : 0) + singles * unit);
  const sellTotal = round2(qty * unit);
  const mrpTotal = round2(qty * mrpUnit);
  return {
    quantity: qty,
    unitPrice: unit,
    bundles,
    bundleSize,
    singles,
    total,
    sellTotal,
    mrpTotal,
    listTotal: mrpTotal,
    savings: round2(sellTotal - total),
  };
}

/**
 * When the shopper is part-way through a combo (e.g. 1 of 2), this says how many more
 * to add to complete it. Returns null when there is no combo or it is already complete.
 */
export function nextComboStep({ quantity, unitPrice, combo }) {
  if (!combo) return null;
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const remainder = qty % combo.quantity;
  if (qty === 0 || remainder === 0) return null;
  return {
    addCount: combo.quantity - remainder,
    comboQuantity: combo.quantity,
    comboPrice: combo.price,
    savingsWhenComplete: round2(combo.quantity * (Number(unitPrice) || 0) - combo.price),
  };
}

/** Discount in rupees that a coupon gives on a given subtotal. */
export function couponDiscount(coupon, subtotal) {
  const value = Number(coupon.discount_value) || 0;
  let amount = coupon.discount_type === "percent" ? (subtotal * value) / 100 : value;
  if (coupon.discount_type === "percent" && coupon.max_discount_amount !== null && coupon.max_discount_amount !== undefined) {
    amount = Math.min(amount, Number(coupon.max_discount_amount));
  }
  return round2(Math.max(0, Math.min(amount, subtotal)));
}

/**
 * Checks whether a coupon can be used on this subtotal right now.
 * Returns { ok: true, discount } or { ok: false, message }.
 * The `now` argument is for tests; callers normally leave it out.
 */
export function checkCoupon(coupon, subtotal, now = new Date()) {
  if (!coupon || coupon.is_active === false) {
    return { ok: false, message: "This coupon code is not valid." };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { ok: false, message: "This coupon has expired." };
  }
  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && Number(coupon.times_used || 0) >= Number(coupon.usage_limit)) {
    return { ok: false, message: "This coupon has been used up." };
  }
  const minOrder = Number(coupon.min_order_amount || 0);
  if (subtotal < minOrder) {
    const more = round2(minOrder - subtotal);
    return { ok: false, message: `Add ₹${more.toLocaleString("en-IN")} more to use this coupon.` };
  }
  return { ok: true, discount: couponDiscount(coupon, subtotal) };
}

/**
 * Order totals. `subtotal` is the sum of the lines after combos, `discount` is the coupon amount.
 * Delivery is free when the amount left to pay reaches the free-delivery threshold.
 */
export function orderTotals({ subtotal, discount = 0, shop }) {
  const sub = round2(Number(subtotal) || 0);
  const discountAmount = round2(Math.max(0, Math.min(Number(discount) || 0, sub)));
  const payable = round2(sub - discountAmount);
  const freeAbove = Number(shop?.freeDeliveryAbove || 0);
  const deliveryCharge =
    payable === 0 || (freeAbove > 0 && payable >= freeAbove) ? 0 : Number(shop?.deliveryCharge ?? 0);
  const taxAmount = round2(payable * Number(shop?.taxRate || 0));
  const total = round2(payable + deliveryCharge + taxAmount);
  return { subtotal: sub, discount: discountAmount, payable, deliveryCharge, taxAmount, total };
}

/** Upper-case, trimmed coupon code. Codes are case-insensitive. */
export function normalizeCouponCode(code) {
  return String(code ?? "").trim().toUpperCase();
}
