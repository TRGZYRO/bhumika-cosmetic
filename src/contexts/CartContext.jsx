import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Shopping cart for Bhumika Cosmetic.
 *
 * The cart lives in the browser (localStorage), so it works for guests and
 * signed-in customers alike and survives a refresh. Prices are re-checked on the
 * server when the order is placed, so nothing sensitive is trusted from here.
 *
 * Each line is { productId, name, brand, sizeLabel, price, image, stock, quantity }.
 */
const CartContext = createContext(null);
const STORAGE_KEY = "bhumika-cart-v1";

function readStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function clampQty(quantity, stock) {
  const max = Math.max(1, Math.min(20, Number(stock) > 0 ? Number(stock) : 20));
  return Math.max(1, Math.min(max, Math.floor(Number(quantity) || 1)));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked: the cart still works for this visit */
    }
  }, [items]);

  /** Adds a product, or increases its quantity if it's already in the cart (up to stock). */
  const addItem = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, stock: product.stock, quantity: clampQty(i.quantity + quantity, product.stock) } : i
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

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    return { items, subtotal, itemCount, addItem, setQuantity, removeItem, clearCart };
  }, [items, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

export default CartContext;
