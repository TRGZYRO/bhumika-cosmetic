/**
 * Catalogue helpers: fetch the shop data, normalise it into one shape for the UI,
 * and format prices. Falls back to the demo catalogue when the API is unavailable.
 */
import { api } from "./api";
import { demoCategories, demoProducts, demoToApi } from "../data/shop.js";

export const DEMO_SHOP = {
  name: "Bhumika Cosmetic",
  tagline: "Beauty essentials for every day, delivered to your door.",
  currency: "INR",
  deliveryCharge: 49,
  freeDeliveryAbove: 499,
  taxRate: 0,
  phone: "",
  email: "",
  address: "",
};

export function formatPrice(value, currency = "INR") {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function normalizeProduct(row) {
  const price = Number(row.base_price ?? row.price ?? 0);
  const compareAt = row.compare_at_price == null ? null : Number(row.compare_at_price);
  const cat = row.categories || null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand || "",
    description: row.description || "",
    howToUse: row.how_to_use || "",
    ingredients: row.ingredients || "",
    sizeLabel: row.size_label || "",
    price,
    compareAt: compareAt && compareAt > price ? compareAt : null,
    stock: Number(row.stock_quantity ?? 0),
    isFeatured: Boolean(row.is_featured),
    image: row.image_url || null,
    categorySlug: cat?.slug || "",
    categoryName: cat?.name || "Other",
  };
}

export function normalizeCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
  };
}

function normalizeShop(shop) {
  if (!shop) return DEMO_SHOP;
  return {
    ...DEMO_SHOP,
    ...Object.fromEntries(Object.entries(shop).filter(([, v]) => v !== null && v !== undefined && v !== "")),
  };
}

/**
 * Loads the catalogue. Returns { products, categories, shop, source } where source is
 * "live" (database) or "demo" (fallback, nothing saved to a database).
 */
export async function loadCatalog() {
  try {
    const data = await api.get("/api/products");
    const products = (data.products || []).map(normalizeProduct);
    const categories = (data.categories || []).map(normalizeCategory);
    return { products, categories, shop: normalizeShop(data.shop), source: "live" };
  } catch {
    const products = demoProducts.map((p) => normalizeProduct(demoToApi(p)));
    const categories = demoCategories.map(normalizeCategory);
    return { products, categories, shop: DEMO_SHOP, source: "demo" };
  }
}

/** Filters, searches and sorts a product list. Used by the Shop page. */
export function filterProducts(products, { q = "", category = "", brand = "", priceRange = "", inStock = false, sort = "featured" }) {
  const term = q.trim().toLowerCase();
  const range = PRICE_RANGES.find((r) => r.key === priceRange);

  let list = products.filter((p) => {
    if (category && p.categorySlug !== category) return false;
    if (brand && p.brand !== brand) return false;
    if (range && (p.price < range.min || p.price > range.max)) return false;
    if (inStock && p.stock <= 0) return false;
    if (term) {
      const haystack = `${p.name} ${p.brand} ${p.categoryName} ${p.description} ${p.ingredients}`.toLowerCase();
      if (!term.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const sorters = {
    featured: (a, b) => Number(b.isFeatured) - Number(a.isFeatured),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  list = [...list].sort(sorters[sort] || sorters.featured);
  return list;
}

export const PRICE_RANGES = [
  { key: "under-500", label: "Under ₹500", min: 0, max: 499.99 },
  { key: "500-1000", label: "₹500 – ₹1,000", min: 500, max: 1000 },
  { key: "1000-2000", label: "₹1,000 – ₹2,000", min: 1000.01, max: 2000 },
  { key: "above-2000", label: "Above ₹2,000", min: 2000.01, max: Infinity },
];

export const SORT_OPTIONS = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "name", label: "Name: A to Z" },
];

/**
 * Order totals. The server runs the same rules when the order is placed (it is the source of truth),
 * so this is only for showing the customer what to expect.
 */
export function calcTotals(subtotal, shop) {
  const freeAbove = Number(shop?.freeDeliveryAbove || 0);
  const deliveryCharge =
    subtotal === 0 || (freeAbove > 0 && subtotal >= freeAbove) ? 0 : Number(shop?.deliveryCharge ?? 0);
  const taxAmount = Math.round(subtotal * Number(shop?.taxRate || 0) * 100) / 100;
  const total = Math.round((subtotal + deliveryCharge + taxAmount) * 100) / 100;
  return { subtotal, deliveryCharge, taxAmount, total };
}
