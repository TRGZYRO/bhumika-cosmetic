/**
 * The Bhumika Cosmetic wordmark: a gold monogram ring with the name beside it.
 * Built from text and CSS so it needs no image file and stays sharp at any size.
 *
 * variant: "nav" (header), "footer", or "loader" (the big brand intro).
 */
const SIZES = {
  nav: { ring: "h-11 w-11 text-xl", name: "text-2xl md:text-[1.7rem]", tag: "text-[9px] md:text-[10px]" },
  footer: { ring: "h-14 w-14 text-2xl", name: "text-3xl", tag: "text-[11px]" },
  loader: { ring: "h-24 w-24 text-5xl", name: "text-6xl md:text-7xl", tag: "text-xs md:text-sm" },
};

export default function Logo({ variant = "nav", className = "" }) {
  const s = SIZES[variant] ?? SIZES.nav;
  const stacked = variant === "loader";

  return (
    <span
      role="img"
      aria-label="Bhumika Cosmetic"
      className={`inline-flex items-center gap-3 ${stacked ? "flex-col text-center gap-5" : ""} ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`${s.ring} flex flex-none items-center justify-center rounded-full border border-gold/80 font-display font-semibold text-gold shadow-[inset_0_0_0_3px_rgb(36_20_25/0.6)]`}
      >
        B
      </span>
      <span className={`flex flex-col leading-none ${stacked ? "items-center" : ""}`}>
        <span className={`font-display font-semibold tracking-tight text-white ${s.name}`}>Bhumika</span>
        <span className={`mt-1.5 font-body font-medium uppercase tracking-[0.34em] text-petal ${s.tag}`}>Cosmetic</span>
      </span>
    </span>
  );
}
