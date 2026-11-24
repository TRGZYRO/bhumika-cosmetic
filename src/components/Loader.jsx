import { useEffect, useState } from "react";
import Logo from "./Logo";
import { prefersReducedMotion } from "../lib/motion";

const SEEN_KEY = "raunaq-intro-seen";

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Brand intro: the logo settles on ink, then the curtain lifts.
 * Plays once per browser session, is skipped for reduced motion, and never blocks
 * the page for more than about 2.5 seconds.
 */
export default function Loader() {
  const [phase, setPhase] = useState(() =>
    alreadySeen() || prefersReducedMotion() ? "gone" : "show"
  );

  useEffect(() => {
    if (phase !== "show") return undefined;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable: the intro simply plays again next time */
    }
    const timer = setTimeout(() => setPhase("leaving"), 1000);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return undefined;
    const timer = setTimeout(() => setPhase("gone"), 600);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div aria-hidden="true" className={`intro ${phase === "leaving" ? "is-leaving" : ""}`}>
      <div className="intro-logo">
        <Logo variant="loader" priority />
      </div>
    </div>
  );
}
