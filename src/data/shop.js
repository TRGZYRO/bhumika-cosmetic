/**
 * Demo catalogue for BHUMIKA COSMETIC.
 *
 * Used only when the database is not connected (demo mode), so the shop can still
 * be previewed. Once Supabase is connected, the catalogue comes from the database
 * and these items are ignored. Prices are in Indian Rupees (₹).
 *
 * `category` must match a `slug` in demoCategories.
 */
export const demoCategories = [
  { id: "c-makeup", slug: "makeup", name: "Makeup", description: "Foundation, lipsticks, eyeshadow and everything for a flawless look." },
  { id: "c-skincare", slug: "skincare", name: "Skincare", description: "Cleansers, serums, moisturisers and sun care for healthy skin." },
  { id: "c-hair", slug: "hair-care", name: "Hair Care", description: "Shampoos, conditioners, masks and styling essentials." },
  { id: "c-fragrance", slug: "fragrance", name: "Fragrance", description: "Perfumes, body mists and signature scents." },
];

export const demoProducts = [
  {
    id: "p1", slug: "velvet-matte-lipstick", name: "Velvet Matte Lipstick", brand: "Bhumika Studio",
    category: "makeup", sizeLabel: "4.2 g", price: 499, compareAt: 599, stock: 24, isFeatured: true,
    description: "A long-wear matte lipstick with a soft, velvety finish that does not dry out lips.",
    howToUse: "Apply directly from the bullet, starting at the centre of the lips and blending outward.",
    ingredients: "Vitamin E, shea butter, jojoba oil.",
  },
  {
    id: "p2", slug: "hydra-glow-serum", name: "Hydra Glow Serum", brand: "Dewy Labs",
    category: "skincare", sizeLabel: "30 ml", price: 899, compareAt: 1099, stock: 12, isFeatured: true,
    description: "A lightweight hyaluronic acid serum that plumps and hydrates for a healthy glow.",
    howToUse: "Apply 2–3 drops to clean skin morning and night, before moisturiser.",
    ingredients: "Hyaluronic acid, niacinamide, aloe vera.",
  },
  {
    id: "p3", slug: "daily-gentle-cleanser", name: "Daily Gentle Cleanser", brand: "Dewy Labs",
    category: "skincare", sizeLabel: "150 ml", price: 349, compareAt: null, stock: 40, isFeatured: false,
    description: "A mild, foaming face wash that removes dirt and makeup without stripping the skin.",
    howToUse: "Massage onto damp skin, rinse with lukewarm water. Use twice daily.",
    ingredients: "Glycerin, chamomile extract, panthenol.",
  },
  {
    id: "p4", slug: "silk-repair-shampoo", name: "Silk Repair Shampoo", brand: "Silk & Stem",
    category: "hair-care", sizeLabel: "250 ml", price: 420, compareAt: 480, stock: 3, isFeatured: true,
    description: "A nourishing shampoo that strengthens damaged hair and leaves it smooth and shiny.",
    howToUse: "Lather on wet hair, massage the scalp, then rinse. Follow with conditioner.",
    ingredients: "Keratin, argan oil, biotin.",
  },
  {
    id: "p5", slug: "rose-noir-eau-de-parfum", name: "Rose Noir Eau de Parfum", brand: "Maison Bhumika",
    category: "fragrance", sizeLabel: "50 ml", price: 1499, compareAt: 1799, stock: 8, isFeatured: true,
    description: "A warm, romantic fragrance with notes of damask rose, oud and soft vanilla.",
    howToUse: "Spray on pulse points — wrists, neck and behind the ears — from about 15 cm away.",
    ingredients: "Alcohol denat., parfum, water.",
  },
  {
    id: "p6", slug: "ultra-hold-compact", name: "Ultra Hold Compact", brand: "Bhumika Studio",
    category: "makeup", sizeLabel: "10 g", price: 379, compareAt: null, stock: 0, isFeatured: false,
    description: "A buildable, oil-control compact powder with a natural matte finish.",
    howToUse: "Press a small amount over foundation with a sponge or puff.",
    ingredients: "Talc, silica, mica.",
  },
  {
    id: "p7", slug: "hydrating-night-cream", name: "Hydrating Night Cream", brand: "Dewy Labs",
    category: "skincare", sizeLabel: "50 g", price: 650, compareAt: 750, stock: 18, isFeatured: false,
    description: "A rich overnight cream that restores moisture while you sleep for softer skin by morning.",
    howToUse: "Apply a thin layer to the face and neck in the evening.",
    ingredients: "Ceramides, squalane, shea butter.",
  },
  {
    id: "p8", slug: "argan-hair-mask", name: "Argan Deep Repair Mask", brand: "Silk & Stem",
    category: "hair-care", sizeLabel: "200 g", price: 540, compareAt: null, stock: 15, isFeatured: false,
    description: "An intensive weekly mask that deeply conditions dry and frizzy hair.",
    howToUse: "Apply to towel-dried hair, leave for 5 minutes, then rinse thoroughly.",
    ingredients: "Argan oil, avocado oil, keratin.",
  },
];

/** Turns a demo product into the same shape the database API returns. */
export function demoToApi(product) {
  const category = demoCategories.find((c) => c.slug === product.category);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    description: product.description,
    how_to_use: product.howToUse,
    ingredients: product.ingredients,
    size_label: product.sizeLabel,
    base_price: product.price,
    compare_at_price: product.compareAt,
    stock_quantity: product.stock,
    is_featured: product.isFeatured,
    is_available: true,
    image_url: product.image || null,
    categories: category ? { id: category.id, name: category.name, slug: category.slug } : null,
  };
}
