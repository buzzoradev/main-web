"use client";

import Link from "next/link";
import { useCart } from "@/components/CartContext";
import { formatPrice } from "@/lib/products";
import JarVisual from "@/components/JarVisual";

export default function CartDrawer() {
  const { items, updateQty, subtotal, drawerOpen, setDrawerOpen } = useCart();

  return (
    <>
      {drawerOpen && (
        <button
          aria-label="Close cart"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur-sm"
        />
      )}
      <aside
        aria-hidden={!drawerOpen}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-lifted transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4">
          <h2 className="font-display text-xl">Your Cart</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close cart"
            className="rounded-full p-2 transition hover:bg-honey-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l14 14" />
              <path d="M19 5L5 19" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-4xl">🍯</p>
            <p className="font-display text-xl">Your cart is empty</p>
            <p className="text-sm text-charcoal-mute">
              The bees have been busy — your jar is waiting.
            </p>
            <Link href="/shop" onClick={() => setDrawerOpen(false)} className="btn-primary mt-2">
              Shop Raw Honey
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.sizeSku}`}
                  className="flex gap-3 rounded-2xl border border-charcoal/10 bg-white p-3"
                >
                  <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl bg-honey-50 p-1">
                    {item.product.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-16 w-auto max-h-16 object-contain drop-shadow-sm"
                      />
                    ) : (
                      <JarVisual tone={item.product.jarTone} label={item.product.honeyType} size={52} />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm font-semibold">{item.product.name}</p>
                    <p className="text-xs text-charcoal-mute">{item.size.weight}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-charcoal/15">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => updateQty(item.productId, item.sizeSku, item.qty - 1)}
                          className="px-3 py-1 text-charcoal-mute transition hover:text-charcoal"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold">{item.qty}</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() => updateQty(item.productId, item.sizeSku, item.qty + 1)}
                          className="px-3 py-1 text-charcoal-mute transition hover:text-charcoal"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm font-bold">{formatPrice(item.lineTotal)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-charcoal/10 px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-charcoal-mute">Subtotal</span>
                <span className="font-display text-lg">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-charcoal-mute">
                Shipping calculated at checkout.
              </p>
              <div className="mt-4 grid gap-2">
                <Link href="/checkout" onClick={() => setDrawerOpen(false)} className="btn-primary w-full">
                  Go to Checkout
                </Link>
                <button onClick={() => setDrawerOpen(false)} className="btn-ghost w-full">
                  Continue Shopping
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
