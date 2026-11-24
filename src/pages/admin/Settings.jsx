import { useEffect, useState } from "react";
import { adminDb } from "../../lib/adminDb";
import { useAuth } from "../../contexts/AuthContext";
import { CheckCircle2 } from "lucide-react";

const EMPTY = {
  id: undefined,
  shop_name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  currency: "INR",
  delivery_charge: 0,
  free_delivery_above: 0,
  tax_rate: 0,
};

/** Shop details, delivery charges and tax. Changing these needs the owner role. */
export default function AdminSettings() {
  const { roles } = useAuth();
  const isOwner = roles?.includes("owner");
  const [form, setForm] = useState(EMPTY);
  const [taxPercent, setTaxPercent] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminDb
      .getSettings()
      .then(({ data }) => {
        if (data) {
          // Saved fields can be null in the database. Keep the empty default for those.
          const clean = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] ?? EMPTY[k]]));
          setForm({ ...clean, id: data.id, shop_name: data.shop_name || "", delivery_charge: data.delivery_charge ?? 0, free_delivery_above: data.free_delivery_above ?? 0 });
          setTaxPercent(String(Math.round(Number(data.tax_rate || 0) * 10000) / 100));
        }
      })
      .catch((err) => setError(err.message || "Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!String(form.shop_name ?? "").trim()) return setError("Please enter the shop name.");
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        shop_name: String(form.shop_name ?? "").trim(),
        tagline: String(form.tagline ?? "").trim(),
        address: String(form.address ?? "").trim(),
        phone: String(form.phone ?? "").trim(),
        email: String(form.email ?? "").trim(),
        currency: "INR",
        delivery_charge: Math.max(0, Number(form.delivery_charge) || 0),
        free_delivery_above: Math.max(0, Number(form.free_delivery_above) || 0),
        tax_rate: Math.max(0, Number(taxPercent) || 0) / 100,
      };
      const { data } = await adminDb.saveSettings(payload);
      setForm((f) => ({ ...f, id: data.id }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-cocoa/60">Loading settings…</p>;

  const label = "mb-2 block text-sm font-semibold text-rosewood";

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 xl:grid-cols-[1.3fr_1fr]">
      <div className="card space-y-6 p-7 md:p-9">
        <h2 className="text-2xl font-semibold text-rosewood">Shop details</h2>
        <div>
          <label htmlFor="s-name" className={label}>Shop name</label>
          <input id="s-name" className="field" value={form.shop_name} onChange={(e) => set("shop_name", e.target.value)} disabled={!isOwner} />
        </div>
        <div>
          <label htmlFor="s-tag" className={label}>Tagline</label>
          <input id="s-tag" className="field" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} disabled={!isOwner} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="s-phone" className={label}>Phone</label>
            <input id="s-phone" type="tel" className="field" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={!isOwner} />
          </div>
          <div>
            <label htmlFor="s-email" className={label}>Email</label>
            <input id="s-email" type="email" className="field" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!isOwner} />
          </div>
        </div>
        <div>
          <label htmlFor="s-addr" className={label}>Address</label>
          <textarea id="s-addr" rows={2} className="field" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={!isOwner} />
        </div>
      </div>

      <div className="space-y-8">
        <div className="card space-y-6 p-7 md:p-9">
          <h2 className="text-2xl font-semibold text-rosewood">Delivery and tax</h2>
          <div>
            <label htmlFor="s-del" className={label}>Delivery charge (₹)</label>
            <input id="s-del" type="number" min="0" step="1" className="field" value={form.delivery_charge} onChange={(e) => set("delivery_charge", e.target.value)} disabled={!isOwner} />
          </div>
          <div>
            <label htmlFor="s-free" className={label}>Free delivery above (₹)</label>
            <input id="s-free" type="number" min="0" step="1" className="field" value={form.free_delivery_above} onChange={(e) => set("free_delivery_above", e.target.value)} disabled={!isOwner} />
            <p className="mt-2 text-xs text-cocoa/55">Set to 0 to always charge delivery.</p>
          </div>
          <div>
            <label htmlFor="s-tax" className={label}>Tax (%)</label>
            <input id="s-tax" type="number" min="0" step="0.5" className="field" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} disabled={!isOwner} />
            <p className="mt-2 text-xs text-cocoa/55">Leave at 0 if your prices already include tax.</p>
          </div>
        </div>

        {!isOwner && <p className="rounded-xl bg-blush p-4 text-sm text-cocoa/70">Only the owner can change these settings.</p>}
        {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}
        {saved && (
          <p className="flex items-center gap-2 rounded-xl border border-[#166534]/25 bg-[#166534]/5 p-4 text-sm text-[#166534]">
            <CheckCircle2 size={16} /> Settings saved.
          </p>
        )}

        {isOwner && (
          <button type="submit" disabled={saving} className="btn btn-primary w-full py-4">
            {saving ? "Saving…" : "Save settings"}
          </button>
        )}
      </div>
    </form>
  );
}
