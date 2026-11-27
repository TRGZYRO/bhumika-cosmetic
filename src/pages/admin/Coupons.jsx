import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { adminDb } from "../../lib/adminDb";
import { formatPrice } from "../../lib/catalog";

const EMPTY = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: "",
  min_order_amount: "",
  max_discount_amount: "",
  usage_limit: "",
  per_customer_limit: "",
  valid_until: "",
  is_active: true,
};

const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
const t = (value) => String(value ?? "").trim();

/** Date for the date input, in Indian time, so a coupon ending on the 31st stays the 31st. */
const toDateInput = (iso) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" }) : "");
/** A coupon is valid until the end of its last day in India. */
const fromDateInput = (date) => (date ? new Date(`${date}T23:59:59+05:30`).toISOString() : null);
const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "No expiry";

function describeDiscount(c, currency = "INR") {
  if (c.discount_type === "percent") {
    const cap = c.max_discount_amount ? `, up to ${formatPrice(c.max_discount_amount, currency)}` : "";
    return `${Number(c.discount_value)}% off${cap}`;
  }
  return `${formatPrice(c.discount_value, currency)} off`;
}

function couponStatus(c) {
  if (!c.is_active) return { label: "Off", tone: "bg-cocoa/10 text-cocoa/60" };
  if (c.valid_until && new Date(c.valid_until) < new Date()) return { label: "Expired", tone: "bg-[#b42318]/10 text-[#b42318]" };
  if (c.usage_limit && c.times_used >= c.usage_limit) return { label: "Used up", tone: "bg-[#a16207]/10 text-[#a16207]" };
  return { label: "Active", tone: "bg-[#166534]/10 text-[#166534]" };
}

function CouponForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() => (initial ? { ...EMPTY, ...initial } : EMPTY));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const label = "mb-2 block text-sm font-semibold text-rosewood";
  const isPercent = form.discount_type === "percent";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const code = t(form.code).toUpperCase();
    if (!CODE_PATTERN.test(code)) return setError("Coupon codes need 3 to 30 letters or numbers, with no spaces.");
    const value = Number(form.discount_value);
    if (t(form.discount_value) === "" || !(value > 0)) return setError("Enter a discount greater than 0.");
    if (isPercent && value > 100) return setError("A percent discount cannot be more than 100.");
    if (t(form.min_order_amount) !== "" && Number(form.min_order_amount) < 0) return setError("The minimum order cannot be negative.");
    if (t(form.usage_limit) !== "" && !(Math.floor(Number(form.usage_limit)) >= 1)) {
      return setError("The usage limit must be at least 1, or left empty for no limit.");
    }
    if (t(form.per_customer_limit) !== "" && !(Math.floor(Number(form.per_customer_limit)) >= 1)) {
      return setError("Uses per customer must be at least 1, or left empty for no limit.");
    }

    const payload = {
      code,
      description: t(form.description) || null,
      discount_type: form.discount_type,
      discount_value: value,
      min_order_amount: t(form.min_order_amount) === "" ? 0 : Number(form.min_order_amount),
      max_discount_amount: isPercent && t(form.max_discount_amount) !== "" ? Number(form.max_discount_amount) : null,
      usage_limit: t(form.usage_limit) === "" ? null : Math.floor(Number(form.usage_limit)),
      per_customer_limit: t(form.per_customer_limit) === "" ? null : Math.floor(Number(form.per_customer_limit)),
      valid_until: fromDateInput(form.valid_until),
      is_active: Boolean(form.is_active),
    };

    setSaving(true);
    try {
      if (initial?.id) await adminDb.updateCoupon(initial.id, payload);
      else await adminDb.createCoupon(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save the coupon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm md:p-10" role="dialog" aria-modal="true" aria-label={initial?.id ? "Edit coupon" : "Add coupon"}>
      <form onSubmit={handleSubmit} noValidate className="card w-full max-w-2xl p-7 md:p-10">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-semibold text-rosewood">{initial?.id ? "Edit coupon" : "Add a coupon"}</h2>
          <button type="button" onClick={onCancel} className="rounded-full p-2 text-cocoa/60 hover:bg-blush" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && <p role="alert" className="mb-6 rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="c-code" className={label}>Coupon code *</label>
            <input
              id="c-code"
              className="field uppercase tracking-wider"
              placeholder="e.g. GLOW10"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="c-type" className={label}>Discount type *</label>
            <select id="c-type" className="field" value={form.discount_type} onChange={(e) => set("discount_type", e.target.value)}>
              <option value="percent">Percent off (%)</option>
              <option value="fixed">Fixed amount off (₹)</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-value" className={label}>{isPercent ? "Percent off *" : "Amount off (₹) *"}</label>
            <input id="c-value" type="number" min="0" step="1" className="field" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-min" className={label}>Minimum order (₹)</label>
            <input id="c-min" type="number" min="0" step="1" className="field" placeholder="0 for none" value={form.min_order_amount} onChange={(e) => set("min_order_amount", e.target.value)} />
          </div>
          {isPercent && (
            <div>
              <label htmlFor="c-max" className={label}>Maximum discount (₹)</label>
              <input id="c-max" type="number" min="0" step="1" className="field" placeholder="No cap" value={form.max_discount_amount ?? ""} onChange={(e) => set("max_discount_amount", e.target.value)} />
            </div>
          )}
          <div>
            <label htmlFor="c-limit" className={label}>Total uses allowed</label>
            <input id="c-limit" type="number" min="1" step="1" className="field" placeholder="Unlimited" value={form.usage_limit ?? ""} onChange={(e) => set("usage_limit", e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-per" className={label}>Uses per customer</label>
            <input id="c-per" type="number" min="1" step="1" className="field" placeholder="Unlimited" value={form.per_customer_limit ?? ""} onChange={(e) => set("per_customer_limit", e.target.value)} />
            <p className="mt-1 text-xs text-cocoa/55">How many times one account (or phone number for guests) can use this code. For example 1 means once per customer.</p>
          </div>
          <div>
            <label htmlFor="c-until" className={label}>Valid until</label>
            <input id="c-until" type="date" className="field" value={form.valid_until || ""} onChange={(e) => set("valid_until", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="c-desc" className={label}>Description (shown to shoppers)</label>
            <input id="c-desc" className="field" placeholder="e.g. Festive offer, 10% off skincare" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 text-sm text-cocoa">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 rounded border-petal text-rose focus:ring-rose" />
              Coupon is on (shoppers can use it)
            </label>
          </div>
        </div>

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-petal pt-6 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="btn btn-ghost-dark px-7 py-3">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary px-8 py-3">
            {saving ? "Saving…" : initial?.id ? "Save changes" : "Add coupon"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (new) | coupon (edit)

  async function load() {
    setError("");
    try {
      setCoupons(await adminDb.listCoupons());
    } catch (err) {
      setError(err.message || "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return coupons;
    return coupons.filter((c) => `${c.code} ${c.description || ""}`.toLowerCase().includes(term));
  }, [coupons, search]);

  async function toggle(c) {
    try {
      const updated = await adminDb.updateCoupon(c.id, { is_active: !c.is_active });
      setCoupons((list) => list.map((x) => (x.id === c.id ? { ...x, ...updated.data } : x)));
    } catch (err) {
      setError(err.message || "Could not update the coupon.");
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete coupon "${c.code}"? Orders that used it keep their record.`)) return;
    try {
      await adminDb.deleteCoupon(c.id);
      setCoupons((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(err.message || "Could not delete the coupon.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cocoa/45" />
          <input
            type="search"
            aria-label="Search coupons"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or description"
            className="field rounded-full py-3 pl-11"
          />
        </div>
        <button type="button" onClick={() => setEditing({})} className="btn btn-primary px-6 py-3">
          <Plus size={18} /> Add coupon
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-cocoa/60">Loading coupons…</p>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-2xl italic text-rosewood">{coupons.length === 0 ? "No coupons yet." : "No coupons match your search."}</p>
            {coupons.length === 0 && <p className="mt-2 text-sm text-cocoa/60">Add a code such as GLOW10 to offer a discount at checkout.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="bg-blush text-xs uppercase tracking-wider text-cocoa/60">
                <tr>
                  <th className="px-5 py-4 font-semibold">Code</th>
                  <th className="px-5 py-4 font-semibold">Discount</th>
                  <th className="px-5 py-4 font-semibold">Minimum order</th>
                  <th className="px-5 py-4 font-semibold">Used</th>
                  <th className="px-5 py-4 font-semibold">Valid until</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petal/60">
                {rows.map((c) => {
                  const status = couponStatus(c);
                  return (
                    <tr key={c.id} className="hover:bg-blush/50">
                      <td className="px-5 py-4">
                        <p className="font-semibold tracking-wider text-cocoa">{c.code}</p>
                        {c.description && <p className="text-xs text-cocoa/55">{c.description}</p>}
                      </td>
                      <td className="px-5 py-4 text-cocoa/80">{describeDiscount(c)}</td>
                      <td className="px-5 py-4 text-cocoa/80">{Number(c.min_order_amount) > 0 ? formatPrice(c.min_order_amount) : "None"}</td>
                      <td className="px-5 py-4 text-cocoa/80">
                        {c.times_used}{c.usage_limit ? ` of ${c.usage_limit}` : ""}
                        {c.per_customer_limit && <p className="text-xs text-cocoa/55">max {c.per_customer_limit} per customer</p>}
                      </td>
                      <td className="px-5 py-4 text-cocoa/80">{formatDate(c.valid_until)}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggle(c)}
                          aria-pressed={c.is_active}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}
                          title={c.is_active ? "Switch this coupon off" : "Switch this coupon on"}
                        >
                          {status.label}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing({
                              ...c,
                              description: c.description ?? "",
                              discount_value: c.discount_value ?? "",
                              min_order_amount: Number(c.min_order_amount) > 0 ? c.min_order_amount : "",
                              max_discount_amount: c.max_discount_amount ?? "",
                              usage_limit: c.usage_limit ?? "",
                              valid_until: toDateInput(c.valid_until),
                            })}
                            className="rounded-full p-2 text-rosewood hover:bg-blush"
                            aria-label={`Edit ${c.code}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => remove(c)} className="rounded-full p-2 text-[#b42318] hover:bg-[#b42318]/5" aria-label={`Delete ${c.code}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <CouponForm
          initial={editing.id ? editing : null}
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
