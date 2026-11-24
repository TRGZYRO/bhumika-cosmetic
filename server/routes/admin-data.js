import { authenticateRequest, sendError, sendJson } from "../auth.js";

/**
 * Admin data API (service role, admin-only).
 *
 * Login is Firebase, so Supabase RLS cannot see the signed-in user. Every admin
 * read and write goes through this route, which checks the caller first.
 *
 *   GET    ?resource=dashboard | products | categories | orders | staff | settings
 *   POST   ?resource=products | categories | staff
 *   PATCH  ?resource=products | categories | orders&id=<uuid>
 *   DELETE ?resource=products | categories&id=<uuid>; orders&id=<uuid> or orders&scope=cancelled (cancelled orders only)
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
  "stock_quantity",
  "category_id",
  "image_url",
  "is_available",
  "is_featured",
];
const CATEGORY_FIELDS = ["name", "slug", "description", "sort_order", "is_active"];
const ORDER_FIELDS = ["order_status", "payment_status"];
const ORDER_STATUSES = ["pending", "confirmed", "out_for_delivery", "completed", "cancelled"];
const ROLES = ["owner", "manager", "staff", "customer"];

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
        fields.slug = await uniqueSlug(sb, "products", fields.slug || fields.name);
        const { data, error } = await sb.from("products").insert(fields).select().single();
        if (error) return sendError(res, 400, error.message);
        return sendJson(res, 201, { data });
      }
      if (req.method === "PATCH" && id) {
        const fields = pick(body, PRODUCT_FIELDS);
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
