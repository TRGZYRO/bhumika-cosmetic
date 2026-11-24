/**
 * GET /api/products
 * Public read of the catalogue: products, active categories and shop settings.
 * Supports ?id= for a single product (with its related products).
 * Read-only, no auth required. Only available products are returned.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

function toShop(row) {
  if (!row) return null;
  return {
    name: row.shop_name,
    tagline: row.tagline,
    phone: row.phone,
    email: row.email,
    address: row.address,
    currency: row.currency || "INR",
    deliveryCharge: Number(row.delivery_charge || 0),
    freeDeliveryAbove: Number(row.free_delivery_above || 0),
    taxRate: Number(row.tax_rate || 0),
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: "Server is missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.",
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const id = req.query.id;

  const [categoriesRes, settingsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("business_settings").select("*").limit(1).maybeSingle(),
  ]);
  const categories = categoriesRes.data || [];
  const shop = toShop(settingsRes.data);

  if (id) {
    const [product, related] = await Promise.all([
      supabase.from("products").select("*, categories (id, name, slug)").eq("id", id).eq("is_available", true).single(),
      supabase.from("products").select("*, categories (id, name, slug)").eq("is_available", true).neq("id", id).limit(4),
    ]);

    if (product.error?.code === "PGRST116") {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.error) return res.status(500).json({ error: product.error.message });

    return res.status(200).json({
      product: product.data,
      related: related.data || [],
      categories,
      shop,
    });
  }

  const { data, error } = await supabase
    .from("products")
    .select("*, categories (id, name, slug)")
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ products: data || [], categories, shop });
}
