"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { products } from "@/lib/products";

const CartContext = createContext(null);
const STORAGE_KEY = "buzzora-cart-v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { productId, sizeSku, qty }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setItems(saved);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = (productId, sizeSku, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId && i.sizeSku === sizeSku);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId && i.sizeSku === sizeSku ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...prev, { productId, sizeSku, qty }];
    });
    setDrawerOpen(true);
  };

  const updateQty = (productId, sizeSku, qty) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => !(i.productId === productId && i.sizeSku === sizeSku))
        : prev.map((i) =>
            i.productId === productId && i.sizeSku === sizeSku ? { ...i, qty } : i
          )
    );
  };

  const clearCart = () => setItems([]);

  const detailed = useMemo(
    () =>
      items
        .map((i) => {
          const product = products.find((p) => p.id === i.productId);
          const size = product?.sizes.find((s) => s.sku === i.sizeSku);
          if (!product || !size) return null;
          return { ...i, product, size, lineTotal: size.price * i.qty };
        })
        .filter(Boolean),
    [items]
  );

  const subtotal = detailed.reduce((sum, i) => sum + i.lineTotal, 0);
  const count = detailed.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider
      value={{
        items: detailed,
        addItem,
        updateQty,
        clearCart,
        subtotal,
        count,
        drawerOpen,
        setDrawerOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
