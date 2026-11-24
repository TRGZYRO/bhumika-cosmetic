import { useEffect, useRef, useState } from "react";

/**
 * Trigger-once reveal (the "reveal-on-enter" pattern): the wrapper eases up the first
 * time it enters the viewport and then stays visible. `delay` staggers siblings.
 * `immediate` reveals on mount, for content that is already on screen (hero).
 * `variant="image"` unveils a photograph with a masked wipe instead of a fade.
 */
export default function Reveal({
  as: Tag = "div",
  delay = 0,
  immediate = false,
  variant = "fade",
  className = "",
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (immediate) {
      setVisible(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <Tag
      ref={ref}
      className={`${variant === "image" ? "img-reveal" : "reveal"} ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={{ ...style, "--d": `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
