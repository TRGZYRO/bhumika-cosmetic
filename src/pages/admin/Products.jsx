import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Upload, Star } from "lucide-react";
import { adminDb, media } from "../../lib/adminDb";
import { formatPrice } from "../../lib/catalog";
import Image from "../../components/Image";

const EMPTY = {
  name: "",
  brand: "",
  category_id: "",
  description: "",
  how_to_use: "",
  ingredients: "",
  size_label: "",
  base_price: "",
  compare_at_price: "",
  stock_quantity: 0,
  image_url: "",
  is_available: true,
  is_featured: false,
};

function ProductForm({ initial, categories, onCancel, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await media.upload(file);
      set("image_url", url);
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Please enter a product name.");
    if (form.base_price === "" || Number(form.base_price) < 0) return setError("Please enter a valid price.");
    if (form.compare_at_price !== "" && Number(form.compare_at_price) < Number(form.base_price)) {
      return setError("The MRP should be the same as or higher than the price.");
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      category_id: form.category_id || null,
      description: form.description.trim() || null,
      how_to_use: form.how_to_use.trim() || null,
      ingredients: form.ingredients.trim() || null,
      size_label: form.size_label.trim() || null,
      base_price: Number(form.base_price),
      compare_at_price: form.compare_at_price === "" ? null : Number(form.compare_at_price),
      stock_quantity: Math.max(0, Math.floor(Number(form.stock_quantity) || 0)),
      image_url: form.image_url || null,
      is_available: Boolean(form.is_available),
      is_featured: Boolean(form.is_featured),
    };

    setSaving(true);
    try {
      if (initial?.id) await adminDb.updateProduct(initial.id, payload);
      else await adminDb.createProduct(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save the product.");
    } finally {
      setSaving(false);
    }
  }

  const label = "mb-2 block text-sm font-semibold text-rosewood";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm md:p-10" role="dialog" aria-modal="true" aria-label={initial?.id ? "Edit product" : "Add product"}>
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-3xl p-7 md:p-10">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-semibold text-rosewood">{initial?.id ? "Edit product" : "Add a product"}</h2>
          <button type="button" onClick={onCancel} className="rounded-full p-2 text-cocoa/60 hover:bg-blush" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && <p role="alert" className="mb-6 rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div>
            <p className={label}>Photo</p>
            <div className="overflow-hidden rounded-2xl border border-petal">
              <Image src={form.image_url} alt="Product photo preview" fallbackLabel="No photo yet" className="h-48" />
            </div>
            <label className="btn btn-ghost-dark mt-3 w-full cursor-pointer py-2.5 text-sm">
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImage} className="sr-only" disabled={uploading} />
            </label>
            <p className="mt-2 text-xs text-cocoa/55">JPG, PNG or WebP, under 3 MB.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="p-name" className={label}>Product name *</label>
              <input id="p-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-brand" className={label}>Brand</label>
              <input id="p-brand" className="field" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-cat" className={label}>Category</label>
              <select id="p-cat" className="field" value={form.category_id || ""} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-price" className={label}>Selling price (₹) *</label>
              <input id="p-price" type="number" min="0" step="1" className="field" value={form.base_price} onChange={(e) => set("base_price", e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-mrp" className={label}>MRP (₹, optional)</label>
              <input id="p-mrp" type="number" min="0" step="1" className="field" value={form.compare_at_price ?? ""} onChange={(e) => set("compare_at_price", e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-size" className={label}>Size / volume</label>
              <input id="p-size" className="field" placeholder="e.g. 30 ml" value={form.size_label} onChange={(e) => set("size_label", e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-stock" className={label}>Stock quantity</label>
              <input id="p-stock" type="number" min="0" step="1" className="field" value={form.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="p-desc" className={label}>Description</label>
              <textarea id="p-desc" rows={3} className="field" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="p-how" className={label}>How to use</label>
              <textarea id="p-how" rows={2} className="field" value={form.how_to_use} onChange={(e) => set("how_to_use", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="p-ing" className={label}>Key ingredients</label>
              <textarea id="p-ing" rows={2} className="field" value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-6 md:col-span-2">
              <label className="flex items-center gap-3 text-sm text-cocoa">
                <input type="checkbox" checked={form.is_available} onChange={(e) => set("is_available", e.target.checked)} className="h-4 w-4 rounded border-petal text-rose focus:ring-rose" />
                Visible in the shop
              </label>
              <label className="flex items-center gap-3 text-sm text-cocoa">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="h-4 w-4 rounded border-petal text-rose focus:ring-rose" />
                Show on the homepage
              </label>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-petal pt-6 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="btn btn-ghost-dark px-7 py-3">Cancel</button>
          <button type="submit" disabled={saving || uploading} className="btn btn-primary px-8 py-3">
            {saving ? "Saving…" : initial?.id ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (new) | product (edit)

  async function load() {
    setError("");
    try {
      const [p, c] = await Promise.all([adminDb.listProducts(), adminDb.listCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (err) {
      setError(err.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) => `${p.name} ${p.brand || ""} ${p.categories?.name || ""}`.toLowerCase().includes(t));
  }, [products, search]);

  async function remove(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await adminDb.deleteProduct(p.id);
      setProducts((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err.message || "Could not delete the product.");
    }
  }

  async function toggle(p, field) {
    try {
      const updated = await adminDb.updateProduct(p.id, { [field]: !p[field] });
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...updated.data } : x)));
    } catch (err) {
      setError(err.message || "Could not update the product.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cocoa/45" />
          <input
            type="search"
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand or category"
            className="field rounded-full py-3 pl-11"
          />
        </div>
        <button type="button" onClick={() => setEditing({})} className="btn btn-primary px-6 py-3">
          <Plus size={18} /> Add product
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-cocoa/60">Loading products…</p>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-2xl italic text-rosewood">{products.length === 0 ? "No products yet." : "No products match your search."}</p>
            {products.length === 0 && <p className="mt-2 text-sm text-cocoa/60">Add your first product to start selling.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-blush text-xs uppercase tracking-wider text-cocoa/60">
                <tr>
                  <th className="px-5 py-4 font-semibold">Product</th>
                  <th className="px-5 py-4 font-semibold">Category</th>
                  <th className="px-5 py-4 font-semibold">Price</th>
                  <th className="px-5 py-4 font-semibold">Stock</th>
                  <th className="px-5 py-4 font-semibold">Shop</th>
                  <th className="px-5 py-4 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petal/60">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-blush/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 flex-none overflow-hidden rounded-xl">
                          <Image src={p.image_url} alt="" fallbackLabel="" className="h-full" aspectRatio="1 / 1" />
                        </div>
                        <div>
                          <p className="flex items-center gap-2 font-semibold text-cocoa">
                            {p.name}
                            {p.is_featured && <Star size={13} className="text-gold" fill="currentColor" aria-label="Featured" />}
                          </p>
                          <p className="text-xs text-cocoa/55">{p.brand || "No brand"}{p.size_label ? ` · ${p.size_label}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-cocoa/75">{p.categories?.name || "—"}</td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-cocoa">{formatPrice(p.base_price)}</span>
                      {p.compare_at_price && <span className="ml-2 text-xs text-cocoa/45 line-through">{formatPrice(p.compare_at_price)}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${p.stock_quantity === 0 ? "text-[#b42318]" : p.stock_quantity <= 5 ? "text-[#a16207]" : "text-cocoa"}`}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggle(p, "is_available")}
                        aria-pressed={p.is_available}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${p.is_available ? "bg-[#166534]/10 text-[#166534]" : "bg-cocoa/10 text-cocoa/60"}`}
                      >
                        {p.is_available ? "Visible" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setEditing(p)} className="rounded-full p-2 text-rosewood hover:bg-blush" aria-label={`Edit ${p.name}`}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => remove(p)} className="rounded-full p-2 text-[#b42318] hover:bg-[#b42318]/5" aria-label={`Delete ${p.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ProductForm
          initial={editing.id ? {
            ...editing,
            category_id: editing.category_id || "",
            compare_at_price: editing.compare_at_price ?? "",
            base_price: editing.base_price ?? "",
          } : null}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setLoading(true);
            load();
          }}
        />
      )}
    </div>
  );
}
