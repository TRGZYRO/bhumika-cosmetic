import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Phone, MapPin, Trash2, ExternalLink } from "lucide-react";
import { adminDb } from "../../lib/adminDb";
import { formatPrice } from "../../lib/catalog";

/** Map pin the customer set at checkout (null when they typed the address without a pin). */
function deliveryPin(o) {
  const lat = o.delivery_latitude === null || o.delivery_latitude === undefined ? NaN : Number(o.delivery_latitude);
  const lng = o.delivery_longitude === null || o.delivery_longitude === undefined ? NaN : Number(o.delivery_longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function DeliveryMap({ order }) {
  const pin = deliveryPin(order);
  if (!pin) {
    return <p className="rounded-xl bg-white p-4 text-cocoa/60">No map pin. The customer did not mark the location on the map.</p>;
  }
  const d = 0.006; // roughly 600 m around the pin
  const bbox = [pin.lng - d, pin.lat - d, pin.lng + d, pin.lat + d].join(",");
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${pin.lat},${pin.lng}`;
  const coords = `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-cocoa/60">Map pin from checkout</p>
      <iframe
        title={`Delivery location for order ${order.order_number}`}
        src={embed}
        className="h-64 w-full rounded-2xl border border-petal"
        loading="lazy"
      />
      <p className="text-cocoa/75">Coordinates: <span className="font-mono">{coords}</span></p>
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <a href={`https://www.google.com/maps?q=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-rosewood hover:text-rose">
          <ExternalLink size={14} /> Open in Google Maps
        </a>
        <a href={`https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=17/${pin.lat}/${pin.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-rosewood hover:text-rose">
          <ExternalLink size={14} /> Open in OpenStreetMap
        </a>
      </div>
    </div>
  );
}

const STATUSES = [
  { key: "pending", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "completed", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];
const STATUS_STYLES = {
  pending: "bg-gold/20 text-[#7a5a1f]",
  confirmed: "bg-petal text-rosewood",
  out_for_delivery: "bg-rose/15 text-rosewood",
  completed: "bg-[#166534]/10 text-[#166534]",
  cancelled: "bg-[#b42318]/10 text-[#b42318]",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  async function load() {
    try {
      setOrders(await adminDb.listOrders());
      setError("");
    } catch (err) {
      setError(err.message || "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { all: orders.length };
    STATUSES.forEach((s) => (c[s.key] = orders.filter((o) => o.order_status === s.key).length));
    return c;
  }, [orders]);

  const visible = filter === "all" ? orders : orders.filter((o) => o.order_status === filter);

  async function setStatus(order, status) {
    setSavingId(order.id);
    setError("");
    try {
      const { data } = await adminDb.updateOrder(order.id, { order_status: status });
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, ...data } : o)));
    } catch (err) {
      setError(err.message || "Could not update the order.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteOrder(order) {
    if (!window.confirm(`Delete cancelled order ${order.order_number}? This cannot be undone.`)) return;
    setSavingId(order.id);
    setError("");
    try {
      await adminDb.deleteOrder(order.id);
      setOrders((list) => list.filter((o) => o.id !== order.id));
      if (openId === order.id) setOpenId(null);
    } catch (err) {
      setError(err.message || "Could not delete the order.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteAllCancelled() {
    const n = counts.cancelled || 0;
    if (n === 0) return;
    if (!window.confirm(`Delete all ${n} cancelled order${n === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setError("");
    try {
      await adminDb.deleteCancelledOrders();
      setOrders((list) => list.filter((o) => o.order_status !== "cancelled"));
      setOpenId(null);
    } catch (err) {
      setError(err.message || "Could not delete the cancelled orders.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter orders by status">
        {[{ key: "all", label: "All" }, ...STATUSES].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter(s.key)}
            aria-pressed={filter === s.key}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filter === s.key ? "bg-rosewood text-white" : "bg-white text-cocoa ring-1 ring-petal hover:ring-rose"
            }`}
          >
            {s.label} <span className="opacity-70">({counts[s.key] ?? 0})</span>
          </button>
        ))}
      </div>

      {counts.cancelled > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-petal">
          <p className="text-sm text-cocoa/70">
            {counts.cancelled} cancelled order{counts.cancelled === 1 ? "" : "s"}. Cancelled orders can be removed from the list.
          </p>
          <button
            type="button"
            onClick={deleteAllCancelled}
            className="inline-flex items-center gap-2 rounded-full bg-[#b42318] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Trash2 size={15} /> Delete all cancelled
          </button>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-cocoa/60">Loading orders…</p>
        ) : visible.length === 0 ? (
          <p className="p-12 text-center font-display text-2xl italic text-rosewood">No orders here yet.</p>
        ) : (
          <ul className="divide-y divide-petal/60">
            {visible.map((o) => {
              const open = openId === o.id;
              return (
                <li key={o.id}>
                  <div className="flex flex-wrap items-center gap-4 px-6 py-5 md:px-7">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : o.id)}
                      aria-expanded={open}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      {open ? <ChevronUp size={18} className="text-cocoa/50" /> : <ChevronDown size={18} className="text-cocoa/50" />}
                      <span>
                        <span className="block font-semibold text-cocoa">{o.order_number}</span>
                        <span className="text-xs text-cocoa/55">
                          {o.customer_name} · {new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </button>
                    <span className="font-semibold text-cocoa">{formatPrice(o.total_amount)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[o.order_status] || ""}`}>
                      {STATUSES.find((s) => s.key === o.order_status)?.label || o.order_status}
                    </span>
                    <label className="sr-only" htmlFor={`status-${o.id}`}>Order status</label>
                    <select
                      id={`status-${o.id}`}
                      value={o.order_status}
                      disabled={savingId === o.id}
                      onChange={(e) => setStatus(o, e.target.value)}
                      className="rounded-full border border-petal bg-white px-4 py-2 text-sm text-cocoa focus:border-rose focus:outline-none disabled:opacity-60"
                    >
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    {o.order_status === "cancelled" && (
                      <button
                        type="button"
                        onClick={() => deleteOrder(o)}
                        disabled={savingId === o.id}
                        aria-label={`Delete cancelled order ${o.order_number}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#b42318]/40 px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#b42318]/5 disabled:opacity-60"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                  </div>

                  {open && (
                    <div className="grid gap-8 bg-blush/50 px-6 py-6 md:grid-cols-[1fr_1fr] md:px-7">
                      <div>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cocoa/60">Items</h3>
                        <ul className="space-y-2 text-sm">
                          {(o.order_items || []).map((i) => (
                            <li key={i.id} className="flex justify-between gap-4">
                              <span>{i.product_name}{i.variant_name ? ` · ${i.variant_name}` : ""} × {i.quantity}</span>
                              <span className="font-medium">{formatPrice(i.total_price)}</span>
                            </li>
                          ))}
                        </ul>
                        <dl className="mt-5 space-y-1.5 border-t border-petal pt-4 text-sm">
                          <div className="flex justify-between"><dt className="text-cocoa/65">Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
                          {Number(o.discount_amount) > 0 && (
                            <div className="flex justify-between text-[#166534]"><dt>Coupon{o.coupon_code ? ` ${o.coupon_code}` : ""}</dt><dd>−{formatPrice(o.discount_amount)}</dd></div>
                          )}
                          <div className="flex justify-between"><dt className="text-cocoa/65">Delivery</dt><dd>{Number(o.delivery_charge) === 0 ? "Free" : formatPrice(o.delivery_charge)}</dd></div>
                          <div className="flex justify-between font-semibold"><dt>Total (cash on delivery)</dt><dd>{formatPrice(o.total_amount)}</dd></div>
                        </dl>
                      </div>
                      <div className="space-y-4 text-sm">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-cocoa/60">Customer</h3>
                        <p className="flex items-center gap-2 font-medium text-cocoa"><Phone size={15} className="text-gold" /> {o.customer_name} · {o.customer_phone}</p>
                        {o.customer_email && <p className="text-cocoa/75">{o.customer_email}</p>}
                        <p className="flex items-start gap-2 text-cocoa/75"><MapPin size={15} className="mt-0.5 flex-none text-gold" /> {o.delivery_address}</p>
                        {o.delivery_landmark && <p className="text-cocoa/75"><span className="font-semibold text-cocoa">Landmark:</span> {o.delivery_landmark}</p>}
                        <DeliveryMap order={o} />
                        {o.special_instructions && (
                          <p className="rounded-xl bg-white p-4 text-cocoa/75"><span className="font-semibold text-cocoa">Note:</span> {o.special_instructions}</p>
                        )}
                        <p className="text-xs text-cocoa/55">Payment: {o.payment_status === "paid" ? "Paid" : "Cash on delivery (collect on delivery)"}</p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
