import { authenticateRequest, sendError, sendJson } from "../auth.js";

/**
 * Admin data API (service role, admin-only).
 *
 * Login is Firebase, so Supabase RLS cannot see the signed-in user. Every admin
 * read and write goes through this route, which checks the caller first.
 *
 *   GET    ?resource=dashboard | products | categories | orders | staff | settings | coupons
 *   POST   ?resource=products | categories | staff | coupons
 *   PATCH  ?resource=products | categories | orders | coupons&id=<uuid>
 *   DELETE ?resource=products | categories | coupons&id=<uuid>; orders&id=<uuid> or orders&scope=cancelled (cancelled orders only)
 *   PUT    ?resource=settings                       (owner only)
 *
 * Writes are whitelisted per resource, so request bodies cannot set arbitrary columns.
 */

const PRODUCT_FIELDS = [
  "name",
  "slug",
  "brand",
  "description",
  "how_to_use",
  "ingredients",
  "size_label",
  "base_price",
  "compare_at_price",
  "combo_quantity",
  "combo_price",
  "stock_quantity",
  "category_id",
  "image_url",
  "is_available",
  "is_featured",
];
const COUPON_FIELDS = [
  "code",
  "description",
  "discount_type",
  "discount_value",
  "min_order_amount",
  "max_discount_amount",
  "usage_limit",
  "per_customer_limit",
  "valid_until",
  "is_active",
];
const CATEGORY_FIELDS = ["name", "slug", "description", "sort_order", "is_active"];
const ORDER_FIELDS = ["order_status", "payment_status"];
const ORDER_STATUSES = ["pending", "confirmed", "out_for_delivery", "completed", "cancelled"];
const ROLES = ["owner", "manager", "staff", "customer"];

/** Coupon codes: letters, digits, dash and underscore, stored in capitals. */
function normalizeCouponFields(fields) {
  const out = { ...fields };
  if (out.code !== undefined) {
    out.code = String(out.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(out.code)) {
      return { error: "Coupon codes need 3 to 30 letters or numbers (no spaces)." };
    }
  }
  if (out.discount_type !== undefined && !["percent", "fixed"].includes(out.discount_type)) {
    return { error: "Choose a discount type: percent or fixed amount." };
  }
  if (out.discount_value !== undefined) {
    const value = Number(out.discount_value);
    if (!Number.isFinite(value) || value <= 0) return { error: "The discount must be more than 0." };
    if (out.discount_type === "percent" && value > 100) return { error: "A percent discount cannot be more than 100." };
    out.discount_value = value;
  }
  for (const key of ["min_order_amount", "max_discount_amount"]) {
    if (out[key] !== undefined) {
      out[key] = out[key] === null || out[key] === "" ? null : Number(out[key]);
      if (out[key] !== null && (!Number.isFinite(out[key]) || out[key] < 0)) return { error: "Amounts cannot be negative." };
    }
  }
  if (out.min_order_amount === null) out.min_order_amount = 0;
  if (out.usage_limit !== undefined) {
    out.usage_limit = out.usage_limit === null || out.usage_limit === "" ? null : Math.floor(Number(out.usage_limit));
    if (out.usage_limit !== null && (!Number.isFinite(out.usage_limit) || out.usage_limit < 1)) {
      return { error: "The usage limit must be at least 1, or left blank for no limit." };
    }
  }
  if (out.per_customer_limit !== undefined) {
    out.per_customer_limit = out.per_customer_limit === null || out.per_customer_limit === "" ? null : Math.floor(Number(out.per_customer_limit));
    if (out.per_customer_limit !== null && (!Number.isFinite(out.per_customer_limit) || out.per_customer_limit < 1)) {
      return { error: "Uses per customer must be at least 1, or left blank for no limit." };
    }
  }
  if (out.valid_until !== undefined) out.valid_until = out.valid_until || null;
  if (out.description !== undefined) out.description = String(out.description || "").trim() || null;
  return { fields: out };
}

/**
 * Combo fields on a product: both set (at least 2 pieces, cheaper than buying them one by one),
 * or both empty for no offer. Only runs when the request includes combo fields, so updates
 * such as the visibility toggle do not clear an existing offer.
 * Returns an error message, or null when the fields are fine (and are normalised in place).
 */
function comboFieldsError(fields) {
  if (!("combo_quantity" in fields) && !("combo_price" in fields)) return null;
  const empty = (v) => v === null || v === undefined || v === "";
  if (empty(fields.combo_quantity) && empty(fields.combo_price)) {
    fields.combo_quantity = null;
    fields.combo_price = null;
    return null;
  }
  if (empty(fields.combo_quantity) || empty(fields.combo_price)) {
    return "Enter both the number of pieces and the combo price, or leave both empty.";
  }
  const quantity = Math.floor(Number(fields.combo_quantity));
  const price = Number(fields.combo_price);
  if (!Number.isFinite(quantity) || quantity < 2) return "A combo needs at least 2 pieces.";
  if (!Number.isFinite(price) || price < 0) return "Enter a valid combo price.";
  if (fields.base_price !== undefined && !(price < Number(fields.base_price) * quantity)) {
    return `The combo price must be lower than buying ${quantity} pieces at the single price.`;
  }
  fields.combo_quantity = quantity;
  fields.combo_price = price;
  return null;
}

const pick = (body, fields) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => fields.includes(k)));

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Make sure a slug is present and unique, adding a short suffix when needed. */
async function uniqueSlug(sb, table, desired, excludeId) {
  const base = slugify(desired) || `item-${Date.now().toString(36)}`;
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    let query = sb.from(table).select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth.ok) return sendError(res, auth.status, auth.error);
  if (!auth.isAdmin) return sendError(res, 403, "Admin access required");

  const url = new URL(req.url, "http://localhost");
  const resource = url.searchParams.get("resource");
  const id = url.searchParams.get("id");
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const sb = auth.supabase;
  const isOwner = auth.roles.includes("owner");

  try {
    // ---------- dashboard ----------
    if (resource === "dashboard" && req.method === "GET") {
      const [productsRes, lowStockRes, ordersRes, categoriesRes] = await Promise.all([
        sb.from("products").select("id", { count: "exact", head: true }),
        sb.from("products").select("id, name, brand, stock_quantity").lte("stock_quantity", 5).order("stock_quantity").limit(8),
        sb
          .from("orders")
          .select("id, order_number, customer_name, total_amount, order_status, payment_status, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        sb.from("categories").select("id", { count: "exact", head: true }),
      ]);
      const orders = ordersRes.data || [];
      const live = orders.filter((o) => o.order_status !== "cancelled");
      return sendJson(res, 200, {
        stats: {
          products: productsRes.count || 0,
          categories: categoriesRes.count || 0,
          orders: orders.length,
          pendingOrders: orders.filter((o) => o.order_status === "pending").length,
          revenue: live.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
        },
        recentOrders: orders.slice(0, 6),
        lowStock: lowStockRes.data || [],
      });
    }

    // ---------- products ----------
    if (resource === "products") {
      if (req.method === "GET") {
        const { data, error } = await sb
          .from("products")
          .select("*, categories(id, name, slug)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return sendJson(res, 200, { data });
      }
      if (req.method === "POST") {
        const fields = pick(body, PRODUCT_FIELDS);
        if (!fields.name) return sendError(res, 400, "Product name is required.");
        const comboError = comboFieldsError(fields);
        if (comboError) return sendError(res, 400, comboError);
        fields.slug = await uniqueSlug(sb, "products", fields.slug || fields.name);
        const { data, error } = await sb.from("products").insert(fields).select().single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 201, { data });
      }
      if (req.method === "PATCH" && id) {
        const fields = pick(body, PRODUCT_FIELDS);
        const comboError = comboFieldsError(fields);
        if (comboError) return sendError(res, 400, comboError);
        if (fields.slug !== undefined) fields.slug = await uniqueSlug(sb, "products", fields.slug, id);
        const { data, error } = await sb
          .from("products")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { data });
      }
      if (req.method === "DELETE" && id) {
        const { error } = await sb.from("products").delete().eq("id", id);
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { ok: true });
      }
    }

    // ---------- categories ----------
    if (resource === "categories") {
      if (req.method === "GET") {
        const { data, error } = await sb.from("categories").select("*").order("sort_order");
        if (error) throw error;
        return sendJson(res, 200, { data });
      }
      if (req.method === "POST") {
        const fields = pick(body, CATEGORY_FIELDS);
        if (!fields.name) return sendError(res, 400, "Category name is required.");
        fields.slug = await uniqueSlug(sb, "categories", fields.slug || fields.name);
        const { data, error } = await sb.from("categories").insert(fields).select().single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 201, { data });
      }
      if (req.method === "PATCH" && id) {
        const fields = pick(body, CATEGORY_FIELDS);
        if (fields.slug !== undefined) fields.slug = await uniqueSlug(sb, "categories", fields.slug, id);
        const { data, error } = await sb.from("categories").update(fields).eq("id", id).select().single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { data });
      }
      if (req.method === "DELETE" && id) {
        const { error } = await sb.from("categories").delete().eq("id", id);
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { ok: true });
      }
    }

    // ---------- coupons ----------
    if (resource === "coupons") {
      if (req.method === "GET") {
        const { data, error } = await sb.from("coupons").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return sendJson(res, 200, { data });
      }
      if (req.method === "POST") {
        const normalized = normalizeCouponFields(pick(body, COUPON_FIELDS));
        if (normalized.error) return sendError(res, 400, normalized.error);
        const fields = normalized.fields;
        if (!fields.code) return sendError(res, 400, "Coupon code is required.");
        if (!fields.discount_type || fields.discount_value === undefined) {
          return sendError(res, 400, "Choose a discount type and amount.");
        }
        const { data, error } = await sb.from("coupons").insert(fields).select().single();
        if (error) {
          const duplicate = error.code === "23505";
          return sendError(res, duplicate ? 409 : 400, duplicate ? "A coupon with this code already exists." : error.message);
        }
        return sendJson(res, 201, { data });
      }
      if (req.method === "PATCH" && id) {
        const normalized = normalizeCouponFields(pick(body, COUPON_FIELDS));
        if (normalized.error) return sendError(res, 400, normalized.error);
        const { data, error } = await sb
          .from("coupons")
          .update({ ...normalized.fields, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) {
          const duplicate = error.code === "23505";
          return sendError(res, duplicate ? 409 : 400, duplicate ? "A coupon with this code already exists." : error.message);
        }
        return sendJson(res, 200, { data });
      }
      if (req.method === "DELETE" && id) {
        const { error } = await sb.from("coupons").delete().eq("id", id);
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { ok: true });
      }
    }

    // ---------- orders ----------
    if (resource === "orders") {
      if (req.method === "GET") {
        const { data, error } = await sb
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return sendJson(res, 200, { data });
      }
      if (req.method === "PATCH" && id) {
        const fields = pick(body, ORDER_FIELDS);
        if (fields.order_status && !ORDER_STATUSES.includes(fields.order_status)) {
          return sendError(res, 400, "Choose a valid order status.");
        }
        const { data, error } = await sb
          .from("orders")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { data });
      }
      // Only cancelled orders can be deleted, so live orders cannot be removed by mistake.
      if (req.method === "DELETE") {
        const scope = url.searchParams.get("scope");
        let query = sb.from("orders").select("id").eq("order_status", "cancelled");
        if (id) query = query.eq("id", id);
        else if (scope !== "cancelled") return sendError(res, 400, "Choose an order to delete.");
        const { data: targets, error: findErr } = await query;
        if (findErr) return sendError(res, 400, findErr.message);
        if (!targets || targets.length === 0) {
          return sendError(res, 400, id ? "Only cancelled orders can be deleted." : "There are no cancelled orders to delete.");
        }
        const orderIds = targets.map((o) => o.id);
        // Remove the line items first, then the orders themselves.
        const { error: itemsErr } = await sb.from("order_items").delete().in("order_id", orderIds);
        if (itemsErr) return sendError(res, 400, itemsErr.message);
        const { error: ordersErr } = await sb.from("orders").delete().in("id", orderIds);
        if (ordersErr) return sendError(res, 400, ordersErr.message);
        return sendJson(res, 200, { ok: true, deleted: orderIds.length });
      }
    }

    // ---------- staff ----------
    if (resource === "staff") {
      if (req.method === "GET") {
        const [profilesRes, rolesRes] = await Promise.all([
          sb.from("profiles").select("*").order("created_at", { ascending: false }),
          sb.from("user_roles").select("*"),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (rolesRes.error) throw rolesRes.error;
        return sendJson(res, 200, { profiles: profilesRes.data || [], roles: rolesRes.data || [] });
      }
      if (req.method === "POST") {
        if (!isOwner) return sendError(res, 403, "Only the owner can assign roles.");
        const email = String(body.email || "").trim().toLowerCase();
        const role = String(body.role || "");
        if (!email) return sendError(res, 400, "Email is required.");
        if (!ROLES.includes(role)) return sendError(res, 400, "Choose a valid role.");

        const { data: profile } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();
        if (!profile) return sendError(res, 404, "No user found with this email. They need to sign up first.");

        const { data, error } = await sb.from("user_roles").insert({ user_id: profile.id, role }).select().single();
        if (error) {
          const duplicate = error.code === "23505";
          return sendError(res, duplicate ? 409 : 400, duplicate ? "This user already has that role." : error.message);
        }
        return sendJson(res, 201, { data });
      }
    }

    // ---------- settings ----------
    if (resource === "settings") {
      if (req.method === "GET") {
        const { data, error } = await sb.from("business_settings").select("*").limit(1).maybeSingle();
        if (error) throw error;
        return sendJson(res, 200, { data });
      }
      if (req.method === "PUT") {
        if (!isOwner) return sendError(res, 403, "Only the owner can change shop settings.");
        const allowed = [
          "shop_name", "tagline", "address", "phone", "email", "currency",
          "delivery_charge", "free_delivery_above", "tax_rate",
        ];
        const fields = { ...pick(body, allowed), updated_at: new Date().toISOString() };
        const query = body.id
          ? sb.from("business_settings").update(fields).eq("id", body.id)
          : sb.from("business_settings").insert(fields);
        const { data, error } = await query.select().single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 200, { data });
      }
    }

    return sendError(res, 404, "Unknown admin resource or method.");
  } catch (err) {
    console.error("Admin data error:", resource, req.method, err);
    return sendError(res, 500, err.message || "Admin request failed.");
  }
}
