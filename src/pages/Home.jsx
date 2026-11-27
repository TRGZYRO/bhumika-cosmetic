import { Link } from "react-router-dom";
import { ArrowRight, Truck, Wallet, Sparkles, MessageCircle } from "lucide-react";
import Reveal from "../components/Reveal";
import Image from "../components/Image";
import ProductCard from "../components/ProductCard";
import { useCatalog } from "../contexts/CatalogContext";
import { formatPrice } from "../lib/catalog";
import { site } from "../data/site";

const CATEGORY_TILE_STYLES = [
  "from-[#7a2e4f] to-[#241419]",
  "from-[#c0557a] to-[#7a2e4f]",
  "from-[#b8864e] to-[#7a2e4f]",
  "from-[#5c1f3a] to-[#241419]",
  "from-[#a24a6e] to-[#3a1a26]",
];

export default function Home() {
  const { products, categories, shop, loading } = useCatalog();
  const currency = shop?.currency || "INR";
  const featured = products.filter((p) => p.isFeatured);
  const showcase = (featured.length ? featured : products).slice(0, 4);
  const heroProduct = showcase[0];
  const freeAbove = shop?.freeDeliveryAbove || 0;
  const comboProducts = products.filter((p) => p.combo && p.stock > 0).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="section-dark relative overflow-hidden px-6 pb-24 pt-36 md:pb-32 md:pt-44">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
          <div className="min-w-0">
            <Reveal immediate>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-petal/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-petal">
                <Sparkles size={14} strokeWidth={1.8} /> New arrivals every week
              </p>
            </Reveal>
            <Reveal as="h1" immediate delay={120} className="text-5xl font-semibold leading-[0.95] text-white sm:text-6xl md:text-8xl break-words">
              Beauty, chosen
              <span className="block italic text-petal">with you in mind.</span>
            </Reveal>
            <Reveal immediate delay={240}>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-mauve md:text-xl">
                {shop?.tagline || site.tagline} Makeup, skincare, hair care and fragrance, all in one place.
              </p>
            </Reveal>
            <Reveal immediate delay={340} className="mt-10 flex flex-wrap gap-4">
              <Link to="/shop" className="btn btn-primary px-8 py-4">
                Shop now <ArrowRight size={18} />
              </Link>
              <Link to="/shop?category=skincare" className="btn btn-ghost-light px-8 py-4">
                Explore skincare
              </Link>
            </Reveal>
          </div>

          <Reveal immediate delay={200} variant="image" className="relative mx-auto w-full min-w-0 max-w-md">
            <div className="rounded-[2.5rem] border border-petal/25 bg-white/5 p-5 backdrop-blur">
              <div className="overflow-hidden rounded-[2rem]">
                <Image src={heroProduct?.image} alt={heroProduct?.name || "Featured product"} className="h-[300px] w-full sm:h-[420px]" fallbackLabel={heroProduct?.name || "Featured product"} eager />
              </div>
              {heroProduct && (
                <div className="flex items-center justify-between px-2 pb-2 pt-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-petal">{heroProduct.brand || "Featured"}</p>
                    <p className="font-display text-2xl text-white">{heroProduct.name}</p>
                  </div>
                  <span className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink">
                    {formatPrice(heroProduct.price, currency)}
                  </span>
                </div>
              )}
              {heroProduct?.combo && (
                <p className="px-2 pb-2 text-sm text-petal">
                  Combo offer: {heroProduct.combo.quantity} for {formatPrice(heroProduct.combo.price, currency)}
                </p>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-petal/50 bg-white px-6 py-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {[
            { icon: Truck, title: freeAbove ? `Free delivery above ${formatPrice(freeAbove, currency)}` : "Delivery to your door", text: "Quick, careful delivery across the city." },
            { icon: Wallet, title: "Cash on delivery", text: "Pay when your order arrives. No card needed." },
            { icon: MessageCircle, title: "Help on WhatsApp", text: "Ask about shades, skin types or your order." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blush text-rosewood">
                <Icon size={20} strokeWidth={1.6} />
              </span>
              <div>
                <p className="font-semibold text-cocoa">{title}</p>
                <p className="text-sm text-cocoa/65">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="section-light px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 text-center">
              <div className="ornament mb-6 text-gold"><span className="diamond" /></div>
              <h2 className="text-5xl font-semibold leading-tight text-rosewood md:text-6xl">Shop by category</h2>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {categories.slice(0, 5).map((cat, i) => (
                <Reveal key={cat.id} delay={i * 90}>
                  <Link
                    to={`/shop?category=${encodeURIComponent(cat.slug)}`}
                    className={`group flex h-56 flex-col justify-end rounded-3xl bg-gradient-to-br p-6 text-white shadow-[0_24px_50px_-28px_rgb(36_20_25/0.6)] transition-transform duration-500 hover:-translate-y-1 ${
                      CATEGORY_TILE_STYLES[i % CATEGORY_TILE_STYLES.length]
                    }`}
                  >
                    <span className="font-display text-3xl font-semibold">{cat.name}</span>
                    <span className="mt-2 line-clamp-2 text-sm text-white/75">{cat.description}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-petal transition-all group-hover:gap-3">
                      Browse <ArrowRight size={15} />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Combo offers */}
      {comboProducts.length > 0 && (
        <section className="section-dark px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-petal">Offers</p>
              <h2 className="mt-3 text-5xl font-semibold leading-tight text-white md:text-6xl">Buy together, pay less</h2>
              <p className="mt-4 text-lg text-mauve">These favourites cost less when you buy the set. Add one more to your cart and the combo price applies.</p>
            </Reveal>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {comboProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={currency} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="section-white px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose">Our picks</p>
              <h2 className="mt-3 text-5xl font-semibold leading-tight text-rosewood md:text-6xl">
                {featured.length ? "Featured favourites" : "Latest products"}
              </h2>
            </div>
            <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-rosewood hover:text-rose">
              View all products <ArrowRight size={16} />
            </Link>
          </Reveal>

          {loading ? (
            <p className="py-16 text-center text-cocoa/60">Loading products…</p>
          ) : showcase.length === 0 ? (
            <p className="py-16 text-center font-display text-2xl italic text-cocoa/60">New products are on the way. Check back soon.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {showcase.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={currency} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
