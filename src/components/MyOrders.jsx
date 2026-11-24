import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatPrice } from "../lib/catalog";

const STEPS = [
  { key: "pending", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "On the way" },
  { key: "completed", label: "Delivered" },
];
const ENDED = { cancelled: "Cancelled" };

function OrderTimeline({ status }) {
  if (ENDED[status]) {
    return <p className="text-sm font-semibold text-cocoa/60">{ENDED[status]}</p>;
  }
  const current = Math.max(0, STEPS.findIndex((s) => s.key === status));
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Order progress">
      {STEPS.map((step, i) => (
        <li
          key={step.key}
          className={`rounded-full px-3 py-1.5 font-semibold ${
            i <= current ? "bg-rosewood text-white" : "bg-blush text-cocoa/50"
          }`}
          aria-current={i === current ? "step" : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

/** The customer's own orders with a simple progress timeline. */
export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/my-orders")
      .then((data) => {
        if (!cancelled) setOrders(data.orders || []);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load your orders right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card p-7 md:p-10">
      <h2 className="mb-6 text-3xl font-semibold text-rosewood">My orders</h2>
      {error && <p className="text-sm text-[#b42318]">{error}</p>}
      {!error && orders === null && <p className="text-sm text-cocoa/60">Loading your orders…</p>}
      {orders && orders.length === 0 && (
        <p className="text-sm text-cocoa/60">You haven&rsquo;t placed any orders yet. <a href="/shop" className="font-semibold text-rosewood hover:text-rose">Start shopping</a>.</p>
      )}
      {orders && orders.length > 0 && (
        <ul className="space-y-6">
          {orders.map((order) => (
            <li key={order.id} className="border-b border-petal/60 pb-6 last:border-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-cocoa">Order {order.order_number}</span>
                <span className="text-sm text-cocoa/60">
                  {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {formatPrice(order.total_amount)}
                </span>
              </div>
              {order.order_items?.length > 0 && (
                <p className="mb-3 text-sm text-cocoa/70">
                  {order.order_items.map((i) => `${i.product_name} × ${i.quantity}`).join(", ")}
                </p>
              )}
              <OrderTimeline status={order.order_status} />
              {order.payment_status !== "paid" && !ENDED[order.order_status] && (
                <p className="mt-2 text-xs text-cocoa/60">Pay in cash when your order is delivered.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
