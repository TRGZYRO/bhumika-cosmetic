import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Image from "../components/Image";
import Reveal from "../components/Reveal";
import { useCart } from "../contexts/CartContext";
import { useCatalog } from "../contexts/CatalogContext";
import { calcTotals, formatPrice } from "../lib/catalog";

export default function CartPage() {
  const { items, subtotal, itemCount, setQuantity, removeItem, clearCart } = useCart();
  const { shop } = useCatalog();
  const navigate = useNavigate();
  const currency = shop?.currency || "INR";
  const totals = calcTotals(subtotal, shop);
  const freeAbove = Number(shop?.freeDeliveryAbove || 0);
  const toFreeDelivery = freeAbove > 0 && subtotal < freeAbove ? freeAbove - subtotal : 0;

  if (itemCount === 0) {
    return (
      <section className="section-light flex min-h-screen items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-rosewood shadow-sm">
            <ShoppingBag size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-semibold leading-tight text-rosewood">Your cart is empty</h1>
          <p className="mt-4 text-lg text-cocoa/70">Find something you love and it will appear here.</p>
          <Link to="/shop" className="btn btn-primary mt-8 px-8 py-4">
            Start shopping <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section-light px-6 pb-28 pt-36 md:pt-44">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-5xl font-semibold leading-tight text-rosewood md:text-6xl">Your cart</h1>
            <p className="mt-2 text-lg text-cocoa/70">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
          </div>
          <button type="button" onClick={() => clearCart()} className="text-sm font-semibold text-[#b42318] hover:opacity-80">
            Clear cart
          </button>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-5">
            {items.map((item, index) => (
              <Reveal as="li" key={item.productId} delay={index * 60} className="card flex gap-5 p-5 md:p-6">
                <Link to={`/product/${item.productId}`} className="w-24 flex-none overflow-hidden rounded-2xl md:w-32">
                  <Image src={item.image} alt={item.name} className="h-24 md:h-32" fallbackLabel={item.name} />
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {item.brand && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose">{item.brand}</p>}
                      <Link to={`/product/${item.productId}`} className="mt-1 block text-xl font-semibold leading-snug text-rosewood hover:text-rose">
                        {item.name}
                      </Link>
                      {item.sizeLabel && <p className="mt-1 text-sm text-cocoa/60">{item.sizeLabel}</p>}
                    </div>
                    <span className="text-lg font-semibold text-cocoa">{formatPrice(item.price * item.quantity, currency)}</span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-4">
                    <div className="flex items-center overflow-hidden rounded-full border border-petal">
                      <button type="button" onClick={() => setQuantity(item.productId, item.quantity - 1)} aria-label={`Decrease ${item.name}`} className="p-2.5 text-cocoa hover:bg-blush">
                        <Minus size={15} strokeWidth={1.6} />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold" aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= Math.max(1, item.stock || 20)}
                        aria-label={`Increase ${item.name}`}
                        className="p-2.5 text-cocoa hover:bg-blush disabled:opacity-35"
                      >
                        <Plus size={15} strokeWidth={1.6} />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeItem(item.productId)} className="inline-flex items-center gap-1.5 text-sm font-medium text-cocoa/60 hover:text-[#b42318]">
                      <Trash2 size={15} strokeWidth={1.6} /> Remove
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>

          <aside className="card h-fit p-7 lg:sticky lg:top-32">
            <h2 className="mb-6 text-3xl font-semibold text-rosewood">Order summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-cocoa/70">Subtotal</dt><dd className="font-medium">{formatPrice(totals.subtotal, currency)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-cocoa/70">Delivery</dt>
                <dd className="font-medium">{totals.deliveryCharge === 0 ? "Free" : formatPrice(totals.deliveryCharge, currency)}</dd>
              </div>
              {totals.taxAmount > 0 && (
                <div className="flex justify-between"><dt className="text-cocoa/70">Tax</dt><dd className="font-medium">{formatPrice(totals.taxAmount, currency)}</dd></div>
              )}
            </dl>
            {toFreeDelivery > 0 && (
              <p className="mt-5 rounded-2xl bg-blush p-4 text-sm text-rosewood">
                Add {formatPrice(toFreeDelivery, currency)} more for free delivery.
              </p>
            )}
            <div className="mt-6 flex items-baseline justify-between border-t border-petal pt-6">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-3xl font-semibold text-rosewood">{formatPrice(totals.total, currency)}</span>
            </div>
            <button type="button" onClick={() => navigate("/checkout")} className="btn btn-primary mt-7 w-full py-4">
              Proceed to checkout <ArrowRight size={18} />
            </button>
            <Link to="/shop" className="mt-4 block text-center text-sm font-semibold text-rosewood hover:text-rose">
              Continue shopping
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
