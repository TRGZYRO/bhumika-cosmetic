import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor has asked the system to reduce motion. */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** Reactive version of prefersReducedMotion(). */
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(QUERY);
    const update = () => setReduce(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduce;
}

/**
 * Gentle background parallax: the element drifts slower than the page.
 * Off for reduced motion. Uses one rAF per frame, never more.
 */
export function useParallax(ref, strength = 0.3) {
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY, 900) * strength;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [ref, reduce, strength]);
}
