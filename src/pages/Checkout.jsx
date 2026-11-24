import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Wallet, Info } from "lucide-react";
import Reveal from "../components/Reveal";
import { useCart } from "../contexts/CartContext";
import { useCatalog } from "../contexts/CatalogContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { calcTotals, formatPrice } from "../lib/catalog";

const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/;

/**
 * Checkout: delivery details, cash on delivery, and order placement.
 * Orders go to /api/orders, which re-checks prices and stock on the server.
 * In demo mode (no database connected) the order is simulated and nothing is saved.
 */
export default function Checkout() {
  const { items, subtotal, itemCount, clearCart } = useCart();
  const { shop, source } = useCatalog();
  const { user, profile, isAuthenticated } = useAuth();
  const currency = shop?.currency || "INR";
  const totals = calcTotals(subtotal, shop);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    pincode: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  // Captured once per mount, so the render stays pure.
  const [demoStamp] = useState(() => Date.now().toString(36).toUpperCase());

  // Pre-fill from the signed-in customer's details (only where the form is still empty).
  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: f.name || profile?.full_name || user?.displayName || "",
      phone: f.phone || profile?.phone || "",
      email: f.email || profile?.email || user?.email || "",
      address: f.address || profile?.address || "",
    }));
  }, [profile, user]);

  if (confirmation) {
    return (
      <section className="section-light flex min-h-screen items-center justify-center px-6 py-28">
        <Reveal className="mx-auto max-w-lg text-center">
          <span className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#166534] shadow-sm">
            <CheckCircle2 size={36} strokeWidth={1.5} />
          </span>
          <h1 className="text-5xl font-semibold leading-tight text-rosewood">Thank you, {confirmation.name.split(" ")[0]}!</h1>
          <p className="mt-4 text-lg text-cocoa/75">
            Your order <span className="font-semibold text-rosewood">{confirmation.orderNumber}</span> has been placed.
            You will pay {formatPrice(confirmation.total, currency)} in cash when it arrives.
          </p>
          {confirmation.demo && (
            <p className="mt-6 rounded-2xl border border-gold/50 bg-white p-4 text-sm text-cocoa/75">
              <Info size={15} className="mr-1.5 inline text-gold" />
              Demo mode: no database is connected, so this order was not saved.
            </p>
          )}
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/shop" className="btn btn-primary px-8 py-4">Continue shopping</Link>
            {isAuthenticated && (
              <Link to="/account" className="btn btn-ghost-dark px-8 py-4">View my orders</Link>
            )}
          </div>
        </Reveal>
      </section>
    );
  }

  if (itemCount === 0) {
    return (
      <section className="section-light flex min-h-screen items-center justify-center px-6 py-24 text-center">
        <div>
          <h1 className="text-4xl font-semibold text-rosewood">Your cart is empty</h1>
          <Link to="/shop" className="btn btn-primary mt-8">Go to shop</Link>
        </div>
      </section>
    );
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!PHONE_PATTERN.test(form.phone.trim())) next.phone = "Enter a valid phone number.";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.address.trim().length < 10) next.address = "Please enter your full delivery address.";
    if (form.pincode.trim() && !/^[0-9]{6}$/.test(form.pincode.trim())) next.pincode = "Pincode should be 6 digits.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setSubmitting(true);

    const customer = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      pincode: form.pincode.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (source === "demo") {
        // No database connected: show the flow, but save nothing.
        const demoNumber = "DEMO-" + demoStamp;
        setConfirmation({ name: customer.name, orderNumber: demoNumber, total: totals.total, demo: true });
        clearCart();
        return;
      }

      const data = await api.post("/api/orders", {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customer,
        paymentMethod: "cod",
      });
      setConfirmation({ name: customer.name, orderNumber: data.order.order_number, total: data.order.total_amount });
      clearCart();
    } catch (err) {
      setError(err.message || "We couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const field = (id, label, props = {}) => (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-rosewood">{label}</label>
      <input
        id={id}
        value={form[id]}
        onChange={(e) => update(id, e.target.value)}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        className="field"
        {...props}
      />
      {errors[id] && <p id={`${id}-error`} className="mt-1.5 text-sm text-[#b42318]">{errors[id]}</p>}
    </div>
  );

  return (
    <section className="section-light px-6 pb-28 pt-36 md:pt-44">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-10 text-5xl font-semibold leading-tight text-rosewood md:text-6xl">Checkout</h1>

        <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            <div className="card p-7 md:p-9">
              <h2 className="mb-6 text-2xl font-semibold text-rosewood">Delivery details</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {field("name", "Full name", { autoComplete: "name" })}
                {field("phone", "Phone number", { type: "tel", autoComplete: "tel", placeholder: "+91 00000 00000" })}
                {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}
                {field("pincode", "Pincode (optional)", { inputMode: "numeric", autoComplete: "postal-code" })}
              </div>
              <div className="mt-5">
                <label htmlFor="address" className="mb-2 block text-sm font-semibold text-rosewood">Delivery address</label>
                <textarea
                  id="address"
                  rows={3}
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? "address-error" : undefined}
                  autoComplete="street-address"
                  className="field"
                  placeholder="House / flat no., street, locality, city, state"
                />
                {errors.address && <p id="address-error" className="mt-1.5 text-sm text-[#b42318]">{errors.address}</p>}
              </div>
              <div className="mt-5">
                <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-rosewood">Note for the delivery (optional)</label>
                <input id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} className="field" placeholder="e.g. call before arriving" />
              </div>
            </div>

            <div className="card p-7 md:p-9">
              <h2 className="mb-6 text-2xl font-semibold text-rosewood">Payment</h2>
              <div className="flex items-start gap-4 rounded-2xl border-2 border-rose bg-blush p-5">
                <Wallet size={22} strokeWidth={1.6} className="mt-0.5 text-rosewood" />
                <div>
                  <p className="font-semibold text-cocoa">Cash on delivery</p>
                  <p className="text-sm text-cocoa/70">Pay in cash when your order is delivered.</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="card h-fit p-7 lg:sticky lg:top-32">
            <h2 className="mb-5 text-2xl font-semibold text-rosewood">Your order</h2>
            <ul className="mb-6 max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map((item) => (
                <li key={item.productId} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-cocoa">
                    {item.name}
                    {item.sizeLabel && <span className="text-cocoa/55"> · {item.sizeLabel}</span>}
                    <span className="text-cocoa/55"> × {item.quantity}</span>
                  </span>
                  <span className="font-medium">{formatPrice(item.price * item.quantity, currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-3 border-t border-petal pt-5 text-sm">
              <div className="flex justify-between"><dt className="text-cocoa/70">Subtotal</dt><dd>{formatPrice(totals.subtotal, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-cocoa/70">Delivery</dt><dd>{totals.deliveryCharge === 0 ? "Free" : formatPrice(totals.deliveryCharge, currency)}</dd></div>
              {totals.taxAmount > 0 && <div className="flex justify-between"><dt className="text-cocoa/70">Tax</dt><dd>{formatPrice(totals.taxAmount, currency)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-petal pt-4">
                <dt className="text-lg font-semibold">To pay</dt>
                <dd className="text-2xl font-semibold text-rosewood">{formatPrice(totals.total, currency)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-5 rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn btn-primary mt-7 w-full py-4">
              {submitting ? "Placing order…" : <>Place order <ArrowRight size={18} /></>}
            </button>
            <Link to="/cart" className="mt-4 block text-center text-sm font-semibold text-rosewood hover:text-rose">
              Edit cart
            </Link>
          </aside>
        </form>
      </div>
    </section>
  );
}
