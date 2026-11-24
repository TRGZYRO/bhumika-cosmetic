import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Reveal from "../components/Reveal";
import ProductCard from "../components/ProductCard";
import { useCatalog } from "../contexts/CatalogContext";
import { filterProducts, PRICE_RANGES, SORT_OPTIONS } from "../lib/catalog";

/**
 * Shop page: search, category, brand, price, stock and sort.
 * Every choice is kept in the address bar (?q=&category=...), so a search can be
 * bookmarked, shared, and survives a refresh.
 */
export default function Shop() {
  const { products, categories, shop, loading } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const currency = shop?.currency || "INR";

  const filters = {
    q: params.get("q") || "",
    category: params.get("category") || "",
    brand: params.get("brand") || "",
    priceRange: params.get("price") || "",
    inStock: params.get("stock") === "1",
    sort: params.get("sort") || "featured",
  };

  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const results = useMemo(() => filterProducts(products, filters), [products, filters.q, filters.category, filters.brand, filters.priceRange, filters.inStock, filters.sort]); // eslint-disable-line react-hooks/exhaustive-deps

  function setParam(key, value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "" || value === false || value == null) next.delete(key);
        else next.set(key, value === true ? "1" : value);
        return next;
      },
      { replace: true }
    );
  }

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  const activeChips = [
    filters.q && { key: "q", label: `"${filters.q}"` },
    filters.category && { key: "category", label: categories.find((c) => c.slug === filters.category)?.name || filters.category },
    filters.brand && { key: "brand", label: filters.brand },
    filters.priceRange && { key: "price", label: PRICE_RANGES.find((r) => r.key === filters.priceRange)?.label },
    filters.inStock && { key: "stock", label: "In stock" },
  ].filter(Boolean);

  const sidebar = (
    <div className="space-y-9">
      <FilterGroup title="Category">
        <RadioRow name="category" checked={!filters.category} onChange={() => setParam("category", "")} label="All categories" />
        {categories.map((c) => (
          <RadioRow
            key={c.slug}
            name="category"
            checked={filters.category === c.slug}
            onChange={() => setParam("category", c.slug)}
            label={c.name}
          />
        ))}
      </FilterGroup>

      {brands.length > 0 && (
        <FilterGroup title="Brand">
          <RadioRow name="brand" checked={!filters.brand} onChange={() => setParam("brand", "")} label="All brands" />
          {brands.map((b) => (
            <RadioRow key={b} name="brand" checked={filters.brand === b} onChange={() => setParam("brand", b)} label={b} />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Price">
        <RadioRow name="price" checked={!filters.priceRange} onChange={() => setParam("price", "")} label="Any price" />
        {PRICE_RANGES.map((r) => (
          <RadioRow key={r.key} name="price" checked={filters.priceRange === r.key} onChange={() => setParam("price", r.key)} label={r.label} />
        ))}
      </FilterGroup>

      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-cocoa">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => setParam("stock", e.target.checked)}
            className="h-4 w-4 rounded border-petal text-rose focus:ring-rose"
          />
          In stock only
        </label>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Header + search */}
      <section className="section-dark px-6 pb-16 pt-36 md:pt-44">
        <div className="mx-auto max-w-7xl">
          <Reveal immediate>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-petal">The shop</p>
          </Reveal>
          <Reveal as="h1" immediate delay={100} className="mt-4 text-6xl font-semibold leading-[0.95] text-white md:text-7xl">
            {filters.category ? categories.find((c) => c.slug === filters.category)?.name || "Shop" : "Find your favourites."}
          </Reveal>
          <Reveal immediate delay={200} className="mt-8 max-w-2xl">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setParam("q", e.currentTarget.elements.q.value.trim());
              }}
              className="relative"
            >
              <label htmlFor="shop-search" className="sr-only">Search products</label>
              <Search size={18} strokeWidth={1.8} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-mauve" aria-hidden="true" />
              <input
                id="shop-search"
                name="q"
                key={filters.q}
                type="search"
                defaultValue={filters.q}
                placeholder="Search by product, brand or ingredient"
                className="w-full rounded-full border border-petal/30 bg-white/5 py-4 pl-14 pr-32 text-white placeholder:text-mauve/70 focus:border-petal focus:bg-white/10 focus:outline-none"
              />
              <button type="submit" className="btn btn-primary absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 text-sm">
                Search
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      <section className="section-light px-6 py-14">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[260px_1fr]">
          {/* Desktop filters */}
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-32 rounded-3xl border border-petal/60 bg-white p-7">{sidebar}</div>
          </aside>

          <div>
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-cocoa/70" aria-live="polite">
                {loading ? "Loading products…" : `${results.length} product${results.length === 1 ? "" : "s"}`}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  aria-expanded={showFilters}
                  className="btn btn-ghost-dark px-5 py-2.5 text-sm lg:hidden"
                >
                  <SlidersHorizontal size={16} /> Filters
                </button>
                <label className="flex items-center gap-2 text-sm text-cocoa/70">
                  <span className="hidden sm:inline">Sort by</span>
                  <select
                    value={filters.sort}
                    onChange={(e) => setParam("sort", e.target.value === "featured" ? "" : e.target.value)}
                    className="rounded-full border border-petal bg-white px-4 py-2 text-sm text-cocoa focus:border-rose focus:outline-none"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {showFilters && <div className="mb-6 rounded-3xl border border-petal/60 bg-white p-7 lg:hidden">{sidebar}</div>}

            {activeChips.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setParam(chip.key, "")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-rosewood ring-1 ring-petal hover:ring-rose"
                  >
                    {chip.label} <X size={13} />
                  </button>
                ))}
                <button type="button" onClick={clearAll} className="px-2 text-xs font-semibold text-rose underline-offset-4 hover:underline">
                  Clear all
                </button>
              </div>
            )}

            {loading ? (
              <p className="py-24 text-center text-cocoa/60">Loading products…</p>
            ) : results.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-rose/40 bg-white/60 px-8 py-20 text-center">
                <p className="font-display text-3xl italic text-rosewood">
                  {products.length === 0 ? "No products yet." : "No products match these filters."}
                </p>
                <p className="mx-auto mt-3 max-w-md text-cocoa/65">
                  {products.length === 0
                    ? "New products are on the way. Please check back soon."
                    : "Try a different search or clear a filter to see more."}
                </p>
                {activeChips.length > 0 && (
                  <button type="button" onClick={clearAll} className="btn btn-primary mt-8 px-7 py-3">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div key={`${filters.category}-${filters.brand}-${filters.priceRange}-${filters.q}-${filters.sort}-${filters.inStock}`} className="menu-enter grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((p, i) => (
                  <ProductCard key={p.id} product={p} currency={currency} index={i} />
                ))}
              </div>
            )}

            <p className="mt-12 text-center text-sm text-cocoa/55">
              Can&rsquo;t find it? <Link to="/shop" onClick={clearAll} className="font-semibold text-rosewood hover:text-rose">Browse everything</Link> or message us on WhatsApp.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function FilterGroup({ title, children }) {
  return (
    <fieldset>
      <legend className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-rose">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

function RadioRow({ name, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-cocoa">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 border-petal text-rose focus:ring-rose" />
      <span className={checked ? "font-semibold text-rosewood" : ""}>{label}</span>
    </label>
  );
}
