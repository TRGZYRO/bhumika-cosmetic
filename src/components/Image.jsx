import { useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * A product photograph that always has a visible size and a visible fallback.
 *
 * - Sizing comes from the parent via `className` (e.g. "h-full", "h-[520px]").
 *   With no height supplied it uses a 4:3 box, so it can never collapse to 0px.
 * - If `src` is empty or the file fails to load, a labelled placeholder is shown
 *   instead of a broken-image icon.
 * - Images lazy-load unless `eager` is set (use it for above-the-fold images).
 */
export default function Image({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  fit = "cover",
  eager = false,
  fallbackLabel,
  aspectRatio = "4 / 3",
}) {
  // Remember which source failed. A new `src` is tried again automatically.
  const [failedSrc, setFailedSrc] = useState(null);

  const label = fallbackLabel || alt || "Photograph coming soon";
  const showFallback = !src || failedSrc === src;
  const ratio = aspectRatio && aspectRatio !== "auto" ? aspectRatio : "4 / 3";

  return (
    <div
      className={`relative w-full overflow-hidden bg-blush ${className}`.trim()}
      style={{ aspectRatio: ratio }}
    >
      {showFallback ? (
        <div
          role="img"
          aria-label={label}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-petal via-blush to-[#e7b8c8] px-6 text-center text-rosewood"
        >
          <Sparkles size={24} strokeWidth={1.4} aria-hidden="true" />
          <span className="font-display text-base italic">{label}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className={`absolute inset-0 h-full w-full ${
            fit === "contain" ? "object-contain" : "object-cover"
          } ${imgClassName}`.trim()}
        />
      )}
    </div>
  );
}
