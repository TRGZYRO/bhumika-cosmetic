import { useEffect, useState } from "react";

const STEPS = [
  "Checking your cart",
  "Confirming delivery details",
  "Reserving your items",
  "Placing your order",
];

/**
 * Full-screen overlay shown while an order is being placed. It is visual only: the
 * real request runs in the checkout page. It keeps the shopper informed and stops
 * them from editing the form or tapping "Place order" again. It goes away when the
 * order is confirmed (the checkout page then shows the thank-you screen).
 */
export default function PlacingOrderOverlay() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/55 px-6 backdrop-blur-sm"
    >
      <div className="order-placing-card w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="relative mx-auto mb-6 h-20 w-20" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border-4 border-petal" />
          <span className="order-ring absolute inset-0 rounded-full border-4 border-transparent border-t-rosewood border-r-rose" />
          <span className="order-pulse absolute inset-4 rounded-full bg-blush" />
        </div>

        <p className="font-display text-2xl font-semibold text-rosewood">Placing your order</p>
        <p key={step} className="order-step mt-2 min-h-[1.5rem] text-sm text-cocoa/70">
          {STEPS[step]}…
        </p>

        <div className="mx-auto mt-6 h-1.5 w-full overflow-hidden rounded-full bg-petal">
          <div className="order-bar h-full rounded-full" />
        </div>

        <p className="mt-4 text-xs text-cocoa/50">Please keep this page open.</p>
      </div>
    </div>
  );
}
