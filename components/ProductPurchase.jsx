"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { formatPrice } from "@/lib/products";

export default function ProductPurchase({ product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [size, setSize] = useState(product.sizes.find((s) => s.inStock) || product.sizes[0]);
  const [qty, setQty] = useState(1);

  const buyNow = () => {
    addItem(product.id, size.sku, qty);
    router.push("/checkout");
  };

  return (
    <div className="mt-7">
      <p className="text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">Size</p>
      <div className="mt-2 flex gap-2">
        {product.sizes.map((s) => (
          <button
            key={s.sku}
            onClick={() => setSize(s)}
            disabled={!s.inStock}
            className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition disabled:opacity-40 ${
              size.sku === s.sku
                ? "border-charcoal bg-charcoal text-cream"
                : "border-charcoal/20 hover:border-charcoal"
            }`}
          >
            <span className="block">{s.weight}</span>
            <span className="block text-xs opacity-70">{formatPrice(s.price)}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="flex items-center rounded-full border border-charcoal/20">
          <button
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-4 py-2.5 text-lg text-charcoal-mute transition hover:text-charcoal"
          >
            −
          </button>
          <span className="min-w-8 text-center font-semibold">{qty}</span>
          <button
            aria-label="Increase quantity"
            onClick={() => setQty((q) => q + 1)}
            className="px-4 py-2.5 text-lg text-charcoal-mute transition hover:text-charcoal"
          >
            +
          </button>
        </div>
        <p className="font-display text-3xl">{formatPrice(size.price * qty)}</p>
        <p className={`text-xs font-semibold ${size.inStock ? "text-forest" : "text-red-600"}`}>
          {size.inStock ? "In stock" : "Out of stock"}
        </p>
      </div>

      {/* Sticky on mobile so Add to Cart is always one thumb away */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-charcoal/10 bg-cream/95 p-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
        <button
          onClick={() => addItem(product.id, size.sku, qty)}
          disabled={!size.inStock}
          className="btn-primary disabled:opacity-40"
        >
          Add to Cart
        </button>
        <button onClick={buyNow} disabled={!size.inStock} className="btn-dark disabled:opacity-40">
          Buy Now
        </button>
      </div>
      <div className="h-16 sm:hidden" aria-hidden />
    </div>
  );
}
