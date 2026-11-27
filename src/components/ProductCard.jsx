import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Check } from "lucide-react";
import Image from "./Image";
import { useCart } from "../contexts/CartContext";
import { formatPrice } from "../lib/catalog";

/** A product tile for grids: photo, brand, name, price and quick add to cart. */
export default function ProductCard({ product, currency = "INR", index = 0 }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;
  const discount = product.compareAt ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100) : 0;

  function handleAdd() {
    if (outOfStock) return;
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <article
      data-testid="product-card"
      style={{ "--i": index }}
      className="group card flex flex-col overflow-hidden transition-shadow duration-700 hover:shadow-[0_34px_70px_-30px_rgb(122_46_79/0.45)]"
    >
      <Link to={`/product/${product.id}`} className="zoom-img relative block h-64 overflow-hidden" aria-label={`View ${product.name}`}>
        <Image src={product.image} alt={product.name} className="h-full" fallbackLabel={product.name} />
        {discount > 0 && (
          <span className="absolute left-4 top-4 rounded-full bg-rosewood px-3 py-1 text-xs font-semibold text-white">
            {discount}% off
          </span>
        )}
        {product.combo && !outOfStock && (
          <span className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">
            {product.combo.quantity} for {formatPrice(product.combo.price, currency)}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/55 font-display text-xl italic text-white">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        {product.brand && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose">{product.brand}</p>
        )}
        <h3 className="mt-1.5 text-2xl font-semibold leading-tight text-rosewood">
          <Link to={`/product/${product.id}`} className="hover:text-rose">{product.name}</Link>
        </h3>
        {product.sizeLabel && <p className="mt-1 text-sm text-cocoa/60">{product.sizeLabel}</p>}
        {product.combo && (
          <p className="mt-2 text-sm font-semibold text-rosewood">
            Buy {product.combo.quantity} together for {formatPrice(product.combo.price, currency)}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-cocoa">{formatPrice(product.price, currency)}</span>
            {product.compareAt && (
              <span className="text-sm text-cocoa/45 line-through">{formatPrice(product.compareAt, currency)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            aria-label={`Add ${product.name} to cart`}
            className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-full transition-colors ${
              added ? "bg-gold text-ink" : "bg-rosewood text-white hover:bg-rose"
            } disabled:bg-cocoa/15 disabled:text-cocoa/40`}
          >
            {added ? <Check size={18} strokeWidth={2} /> : <ShoppingBag size={18} strokeWidth={1.8} />}
          </button>
        </div>
      </div>
    </article>
  );
}
