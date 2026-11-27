import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingBag, Truck, ShieldCheck } from "lucide-react";
import Image from "../components/Image";
import Reveal from "../components/Reveal";
import ProductCard from "../components/ProductCard";
import { useCart } from "../contexts/CartContext";
import { useCatalog } from "../contexts/CatalogContext";
import { api } from "../lib/api";
import { formatPrice, normalizeProduct } from "../lib/catalog";
import { linePricing, nextComboStep } from "../../shared/pricing.js";

/** Product page: photo, price, quantity, add to cart or buy now, and product details. */
export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { products, shop, source } = useCatalog();
  const currency = shop?.currency || "INR";

  // Use the loaded catalogue first; ask the API only if the product isn't in it.
  const fromCatalog = products.find((p) => p.id === id);
  const [fetched, setFetched] = useState(null);
  const [fetchState, setFetchState] = useState(fromCatalog ? "done" : "loading");
  const product = fromCatalog || fetched;

  useEffect(() => {
    if (fromCatalog || source === "demo") {
      setFetchState(fromCatalog ? "done" : "missing");
      return undefined;
    }
    let cancelled = false;
    setFetchState("loading");
    api
      .get(`/api/products?id=${encodeURIComponent(id)}`)
      .then((data) => {
        if (!cancelled) {
          setFetched(normalizeProduct(data.product));
          setFetchState("done");
        }
      })
      .catch(() => {
        if (!cancelled) setFetchState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [id, fromCatalog, source]);

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (fetchState === "loading") {
    return (
      <section className="section-light px-6 py-32 text-center">
        <p className="text-lg text-cocoa/60">Loading product…</p>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="section-light px-6 py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-5xl font-semibold leading-tight text-rosewood">Product not found</h1>
          <p className="mt-4 text-lg text-cocoa/70">This product may have been removed or is no longer available.</p>
          <Link to="/shop" className="btn btn-primary mt-8">
            Back to shop <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    );
  }

  const outOfStock = product.stock <= 0;
  const maxQty = Math.max(1, Math.min(20, product.stock || 20));
  const related = products.filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug).slice(0, 4);
  const discount = product.compareAt ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100) : 0;
  const pricing = linePricing({ quantity, unitPrice: product.price, mrp: product.compareAt, combo: product.combo });
  const comboStep = nextComboStep({ quantity, unitPrice: product.price, combo: product.combo });
  const comboWord = (n) => (n === 2 ? "both" : `all ${n}`);

  function handleAdd(thenCheckout = false) {
    if (outOfStock) return;
    addItem(product, quantity);
    if (thenCheckout) {
      navigate("/checkout");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <>
      <section className="section-light px-6 pb-20 pt-36 md:pt-44">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="mb-10 text-sm text-cocoa/60">
            <Link to="/shop" className="hover:text-rosewood">Shop</Link>
            {product.categorySlug && (
              <>
                {" / "}
                <Link to={`/shop?category=${encodeURIComponent(product.categorySlug)}`} className="hover:text-rosewood">
                  {product.categoryName}
                </Link>
              </>
            )}
            {" / "}
            <span className="text-rosewood">{product.name}</span>
          </nav>

          <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
            <Reveal variant="image" className="card relative overflow-hidden rounded-[2rem]">
              <Image src={product.image} alt={product.name} className="h-[520px] md:h-[560px]" fallbackLabel={product.name} eager />
              {discount > 0 && (
                <span className="absolute left-6 top-6 rounded-full bg-rosewood px-4 py-1.5 text-sm font-semibold text-white">{discount}% off</span>
              )}
            </Reveal>

            <div className="flex flex-col gap-8">
              <Reveal>
                {product.brand && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose">{product.brand}</p>}
                <h1 className="mt-3 text-5xl font-semibold leading-tight text-rosewood md:text-6xl">{product.name}</h1>
                {product.sizeLabel && <p className="mt-3 text-base text-cocoa/65">Size: {product.sizeLabel}</p>}
                {product.description && <p className="mt-6 text-lg leading-relaxed text-cocoa/75">{product.description}</p>}
              </Reveal>

              <Reveal delay={100} className="card p-7 md:p-9">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-4xl font-semibold text-cocoa">{formatPrice(product.price, currency)}</span>
                  {product.compareAt && <span className="text-lg text-cocoa/45 line-through">{formatPrice(product.compareAt, currency)}</span>}
                </div>
                <p className={`mt-3 text-sm font-semibold ${outOfStock ? "text-[#b42318]" : product.stock <= 5 ? "text-[#a16207]" : "text-[#166534]"}`}>
                  {outOfStock ? "Out of stock" : product.stock <= 5 ? `Only ${product.stock} left` : "In stock"}
                </p>

                {!outOfStock && (
                  <div className="mt-7 flex flex-wrap items-center gap-5">
                    <span className="text-sm font-semibold text-cocoa">Quantity</span>
                    <div className="flex items-center overflow-hidden rounded-full border border-petal">
                      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="p-3 text-cocoa hover:bg-blush">
                        <Minus size={16} strokeWidth={1.6} />
                      </button>
                      <span className="w-12 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
                      <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity" className="p-3 text-cocoa hover:bg-blush">
                        <Plus size={16} strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>
                )}

                {product.combo && !outOfStock && (
                  <div className="mt-7 rounded-2xl bg-blush p-5">
                    <p className="font-semibold text-rosewood">
                      Combo offer: {product.combo.quantity} for {formatPrice(product.combo.price, currency)}
                    </p>
                    {comboStep ? (
                      <>
                        <p className="mt-1.5 text-sm text-cocoa/75">
                          Add {comboStep.addCount} more to get {comboWord(product.combo.quantity)} for only{" "}
                          {formatPrice(product.combo.price, currency)}. You save {formatPrice(comboStep.savingsWhenComplete, currency)}.
                        </p>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(maxQty, q + comboStep.addCount))}
                          disabled={quantity + comboStep.addCount > maxQty}
                          className="btn btn-primary mt-4 px-5 py-2.5 text-sm"
                        >
                          Add {comboStep.addCount} more
                        </button>
                      </>
                    ) : (
                      <p className="mt-1.5 text-sm text-cocoa/75">
                        {quantity} for {formatPrice(pricing.total, currency)}
                        {pricing.savings > 0 && <> · you save {formatPrice(pricing.savings, currency)}</>}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={outOfStock} onClick={() => handleAdd(false)} className="btn btn-ghost-dark py-4">
                    {added ? "Added to cart ✓" : <><ShoppingBag size={18} strokeWidth={1.8} /> Add to cart</>}
                  </button>
                  <button type="button" disabled={outOfStock} onClick={() => handleAdd(true)} className="btn btn-primary py-4">
                    Buy now
                  </button>
                </div>
              </Reveal>

              <Reveal delay={150} className="grid gap-4 text-sm text-cocoa/75 sm:grid-cols-2">
                <p className="flex items-start gap-3"><Truck size={18} className="mt-0.5 flex-none text-gold" /> Cash on delivery available</p>
                <p className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 flex-none text-gold" /> Genuine products, carefully packed</p>
              </Reveal>
            </div>
          </div>

          {/* Details */}
          <div className="mt-20 grid gap-6 md:grid-cols-2">
            {product.howToUse && (
              <Reveal className="card p-8">
                <h2 className="mb-4 text-3xl font-semibold text-rosewood">How to use</h2>
                <p className="leading-relaxed text-cocoa/75">{product.howToUse}</p>
              </Reveal>
            )}
            {product.ingredients && (
              <Reveal delay={100} className="card p-8">
                <h2 className="mb-4 text-3xl font-semibold text-rosewood">Key ingredients</h2>
                <p className="leading-relaxed text-cocoa/75">{product.ingredients}</p>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section-white px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-center text-5xl font-semibold text-rosewood">You may also like</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={currency} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
