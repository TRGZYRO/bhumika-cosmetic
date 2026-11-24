import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Tags, ShoppingBag, Clock, IndianRupee, AlertTriangle, ArrowRight } from "lucide-react";
import { adminDb } from "../../lib/adminDb";
import { formatPrice } from "../../lib/catalog";

const STATUS_STYLES = {
  pending: "bg-gold/20 text-[#7a5a1f]",
  confirmed: "bg-petal text-rosewood",
  out_for_delivery: "bg-rose/15 text-rosewood",
  completed: "bg-[#166534]/10 text-[#166534]",
  cancelled: "bg-[#b42318]/10 text-[#b42318]",
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminDb
      .getDashboard()
      .then(setData)
      .catch((err) => setError(err.message || "Could not load the dashboard."));
  }, []);

  const stats = data?.stats;
  const cards = [
    { label: "Revenue", value: stats ? formatPrice(stats.revenue) : "—", icon: IndianRupee, note: "Excluding cancelled" },
    { label: "Orders", value: stats?.orders ?? "—", icon: ShoppingBag, note: "All time" },
    { label: "Pending", value: stats?.pendingOrders ?? "—", icon: Clock, note: "Need confirming" },
    { label: "Products", value: stats?.products ?? "—", icon: Package, note: `${stats?.categories ?? 0} categories` },
  ];

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, note }) => (
          <div key={label} className="card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-cocoa/65">{label}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-rosewood">
                <Icon size={18} strokeWidth={1.6} />
              </span>
            </div>
            <p className="mt-4 font-display text-4xl font-semibold text-rosewood">{value}</p>
            <p className="mt-1 text-xs text-cocoa/55">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-7">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-rosewood">Recent orders</h2>
            <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose hover:text-rosewood">
              All orders <ArrowRight size={15} />
            </Link>
          </div>
          {!data ? (
            <p className="text-sm text-cocoa/60">Loading…</p>
          ) : data.recentOrders.length === 0 ? (
            <p className="text-sm text-cocoa/60">No orders yet. They will appear here when customers check out.</p>
          ) : (
            <ul className="divide-y divide-petal/60">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-semibold text-cocoa">{o.customer_name}</p>
                    <p className="text-xs text-cocoa/55">{o.order_number} · {new Date(o.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[o.order_status] || ""}`}>
                      {o.order_status.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold text-cocoa">{formatPrice(o.total_amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-7">
          <div className="mb-6 flex items-center gap-2">
            <AlertTriangle size={18} className="text-gold" />
            <h2 className="text-2xl font-semibold text-rosewood">Low stock</h2>
          </div>
          {!data ? (
            <p className="text-sm text-cocoa/60">Loading…</p>
          ) : data.lowStock.length === 0 ? (
            <p className="text-sm text-cocoa/60">Everything is well stocked.</p>
          ) : (
            <ul className="space-y-3">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3">
                  <span className="text-sm font-medium text-cocoa">{p.name}{p.brand ? <span className="text-cocoa/55"> · {p.brand}</span> : null}</span>
                  <span className={`text-sm font-bold ${p.stock_quantity === 0 ? "text-[#b42318]" : "text-[#a16207]"}`}>
                    {p.stock_quantity === 0 ? "Out" : `${p.stock_quantity} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/products" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-rose hover:text-rosewood">
            Manage products <Tags size={15} />
          </Link>
        </section>
      </div>
    </div>
  );
}
