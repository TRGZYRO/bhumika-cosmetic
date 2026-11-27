import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCatalog } from "./CatalogContext";
import { api } from "../lib/api";
import { couponDiscount, linePricing, nextComboStep, normalizeCouponCode } from "../../shared/pricing.js";

/**
 * Shopping cart for Bhumika Cosmetic.
 *
 * The cart lives in the browser (localStorage), so it works for guests and
 * signed-in customers alike and survives a refresh. Prices, combo offers and coupons
 * are re-checked on the server when the order is placed, so nothing sensitive is trusted from here.
 *
 * Each stored line is { productId, name, brand, sizeLabel, price, combo, image, stock, quantity }.
 * When the product is in the loaded catalogue, its current price and combo are used
 * for display, so the cart follows admin changes.
 */
const CartContext = createContext(null);
const STORAGE_KEY = "bhumika-cart-v1";
const COUPON_KEY = "bhumika-coupon-v1";

const round2 = (n) => Math.round(n * 100) / 100;
const IDLE_COUPON = { status: "idle", info: null, message: "" };

function readStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function readCoupon() {
  try {
    return normalizeCouponCode(localStorage.getItem(COUPON_KEY) || "");
  } catch {
    return "";
  }
}

function clampQty(quantity, stock) {
  const max = Math.max(1, Math.min(20, Number(stock) > 0 ? Number(stock) : 20));
  return Math.max(1, Math.min(max, Math.floor(Number(quantity) || 1)));
}

export function CartProvider({ children }) {
  const { products, source } = useCatalog();
  const [items, setItems] = useState(readStorage);
  const [couponCode, setCouponCode] = useState(readCoupon);
  // status: idle | checking | applied | invalid. `info` is the coupon the server accepted.
  const [coupon, setCoupon] = useState({ status: "idle", info: null, message: "" });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked: the cart still works for this visit */
    }
  }, [items]);

  useEffect(() => {
    try {
      if (couponCode) localStorage.setItem(COUPON_KEY, couponCode);
      else localStorage.removeItem(COUPON_KEY);
    } catch {
      /* storage blocked: the coupon is simply not remembered after a refresh */
    }
  }, [couponCode]);

  // Ask the server whether the coupon works for the current cart. Runs when the code
  // or any quantity changes, with a short pause so fast clicks send one request.
  const itemsKey = JSON.stringify(items.map((i) => [i.productId, i.quantity]));
  useEffect(() => {
    if (!couponCode || itemsKey === "[]") return undefined; // no coupon: `couponState` below reports idle
    if (source === "demo") {
      setCoupon({ status: "invalid", info: null, message: "Coupons are not available in demo mode." });
      return undefined;
    }
    let cancelled = false;
    setCoupon((c) => ({ ...c, status: "checking" }));
    const payload = JSON.parse(itemsKey).map(([productId, quantity]) => ({ productId, quantity }));
    const timer = setTimeout(() => {
      api
        .post("/api/coupons", { code: couponCode, items: payload })
        .then((data) => {
          if (!cancelled) setCoupon({ status: "applied", info: data.coupon, message: "" });
        })
        .catch((err) => {
          if (!cancelled) setCoupon({ status: "invalid", info: null, message: err.message || "We couldn't check this coupon." });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [couponCode, itemsKey, source]);

  /** Adds a product, or increases its quantity if it's already in the cart (up to stock). */
  const addItem = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, stock: product.stock, combo: product.combo || null, compareAt: product.compareAt || null, quantity: clampQty(i.quantity + quantity, product.stock) }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          brand: product.brand || "",
          sizeLabel: product.sizeLabel || "",
          price: Number(product.price),
          combo: product.combo || null,
          compareAt: product.compareAt || null,
          image: product.image || null,
          stock: Number(product.stock) || 0,
          quantity: clampQty(quantity, product.stock),
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: clampQty(quantity, i.stock) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode("");
  }, []);

  const applyCoupon = useCallback((raw) => {
    const code = normalizeCouponCode(raw);
    if (code) setCouponCode(code);
  }, []);

  const removeCoupon = useCallback(() => setCouponCode(""), []);

  // Current prices from the catalogue when the product is still listed; otherwise what was stored.
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = useMemo(
    () =>
      items.map((item) => {
        const product = productsById.get(item.productId);
        const unitPrice = product ? product.price : item.price;
        const mrp = product ? product.compareAt : item.compareAt;
        const combo = product ? product.combo : item.combo || null;
        return {
          ...item,
          unitPrice,
          combo,
          pricing: linePricing({ quantity: item.quantity, unitPrice, mrp, combo }),
          step: nextComboStep({ quantity: item.quantity, unitPrice, combo }),
        };
      }),
    [items, productsById]
  );

  // With no coupon code or an empty cart, the coupon is idle whatever the last check said.
  const couponState = couponCode && items.length > 0 ? coupon : IDLE_COUPON;

  const value = useMemo(() => {
    const subtotal = round2(lines.reduce((sum, l) => sum + l.pricing.total, 0));
    const sellSubtotal = round2(lines.reduce((sum, l) => sum + l.pricing.sellTotal, 0));
    const comboSavings = round2(sellSubtotal - subtotal);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const discount = couponState.status === "applied" && couponState.info ? couponDiscount(couponState.info, subtotal) : 0;
    return {
      items,
      lines,
      subtotal,
      comboSavings,
      discount,
      couponCode,
      coupon: couponState,
      itemCount,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
    };
  }, [items, lines, couponCode, couponState, addItem, setQuantity, removeItem, clearCart, applyCoupon, removeCoupon]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

export default CartContext;
