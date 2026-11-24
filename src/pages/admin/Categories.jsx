import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { adminDb } from "../../lib/adminDb";

const BLANK = { name: "", description: "", sort_order: 0, is_active: true };

function Row({ item, onSave, onCancel }) {
  const [draft, setDraft] = useState(item);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_100px_auto]">
      <input aria-label="Category name" className="field py-2.5" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <input aria-label="Description" className="field py-2.5" value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <input aria-label="Sort order" type="number" className="field py-2.5" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onSave(draft)} className="rounded-full bg-rosewood p-2.5 text-white hover:bg-rose" aria-label="Save category"><Check size={16} /></button>
        <button type="button" onClick={onCancel} className="rounded-full border border-petal p-2.5 text-cocoa hover:bg-blush" aria-label="Cancel"><X size={16} /></button>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [newItem, setNewItem] = useState(null);

  async function load() {
    try {
      setCategories(await adminDb.listCategories());
    } catch (err) {
      setError(err.message || "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(fn) {
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
  }

  async function saveNew(draft) {
    if (!draft.name.trim()) return setError("Please enter a category name.");
    await run(async () => {
      await adminDb.createCategory({ ...draft, is_active: true });
      setNewItem(null);
    });
  }

  async function saveEdit(draft) {
    if (!draft.name.trim()) return setError("Please enter a category name.");
    await run(async () => {
      await adminDb.updateCategory(draft.id, { name: draft.name, description: draft.description, sort_order: draft.sort_order, is_active: draft.is_active });
      setEditingId(null);
    });
  }

  async function remove(c) {
    if (!window.confirm(`Delete the "${c.name}" category? Products in it will be kept but left without a category.`)) return;
    await run(() => adminDb.deleteCategory(c.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-cocoa/70">
          Categories group products in the shop menu and on the homepage. Lower sort numbers appear first.
        </p>
        <button type="button" onClick={() => setNewItem({ ...BLANK, sort_order: (categories.at(-1)?.sort_order || 0) + 1 })} className="btn btn-primary px-6 py-3">
          <Plus size={18} /> Add category
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

      <div className="card divide-y divide-petal/60 overflow-hidden">
        <div className="hidden bg-blush px-7 py-3 text-xs font-semibold uppercase tracking-wider text-cocoa/60 md:grid md:grid-cols-[1fr_1.4fr_100px_120px]">
          <span>Name</span><span>Description</span><span>Order</span><span className="text-right">Actions</span>
        </div>

        {newItem && (
          <div className="bg-blush/60 p-6">
            <Row item={newItem} onSave={saveNew} onCancel={() => setNewItem(null)} />
          </div>
        )}

        {loading && <p className="p-7 text-sm text-cocoa/60">Loading…</p>}
        {!loading && categories.length === 0 && !newItem && (
          <p className="p-10 text-center font-display text-xl italic text-rosewood">No categories yet. Add one to organise your products.</p>
        )}

        {categories.map((c) => (
          <div key={c.id} className="p-6 md:px-7">
            {editingId === c.id ? (
              <Row item={c} onSave={saveEdit} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="grid items-center gap-3 md:grid-cols-[1fr_1.4fr_100px_120px]">
                <div>
                  <p className="font-semibold text-cocoa">{c.name}</p>
                  <p className="text-xs text-cocoa/50">/{c.slug}{c.is_active ? "" : " · hidden"}</p>
                </div>
                <p className="text-sm text-cocoa/70">{c.description || "—"}</p>
                <p className="text-sm text-cocoa/70">{c.sort_order}</p>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(c.id)} className="rounded-full p-2 text-rosewood hover:bg-blush" aria-label={`Edit ${c.name}`}><Pencil size={16} /></button>
                  <button type="button" onClick={() => remove(c)} className="rounded-full p-2 text-[#b42318] hover:bg-[#b42318]/5" aria-label={`Delete ${c.name}`}><Trash2 size={16} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
