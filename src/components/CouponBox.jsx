import { useState } from "react";
import { useCart } from "../contexts/CartContext";
import { useCatalog } from "../contexts/CatalogContext";
import { formatPrice } from "../lib/catalog";

/**
 * Coupon entry for the cart and checkout. The code is checked on the server against the
 * current cart. This is a plain div, not a form, because checkout is already a form.
 */
export default function CouponBox() {
  const { couponCode, coupon, discount, applyCoupon, removeCoupon } = useCart();
  const { shop } = useCatalog();
  const currency = shop?.currency || "INR";
  const [draft, setDraft] = useState("");

  function submit() {
    if (!draft.trim()) return;
    applyCoupon(draft);
    setDraft("");
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Coupon code"
          aria-label="Coupon code"
          autoComplete="off"
          className="field py-3 uppercase tracking-wider"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || coupon.status === "checking"}
          className="btn btn-ghost-dark flex-none px-5 py-3 text-sm"
        >
          Apply
        </button>
      </div>

      {couponCode && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-white p-4 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-rosewood">{couponCode}</p>
            {coupon.status === "checking" && <p className="text-cocoa/60">Checking coupon…</p>}
            {coupon.status === "applied" && (
              <p className="text-[#166534]">
                Applied. You save {formatPrice(discount, currency)}
                {coupon.info?.description ? ` · ${coupon.info.description}` : ""}
              </p>
            )}
            {coupon.status === "invalid" && <p className="text-[#b42318]">{coupon.message}</p>}
          </div>
          <button type="button" onClick={removeCoupon} className="flex-none font-semibold text-cocoa/60 hover:text-[#b42318]">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
