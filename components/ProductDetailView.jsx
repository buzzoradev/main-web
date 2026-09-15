"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { formatPrice } from "@/lib/products";
import JarVisual from "@/components/JarVisual";
import BeeCharacter from "@/components/BeeCharacter";

export default function ProductDetailView({ product }) {
  const { addItem } = useCart();
  const router = useRouter();
  
  const [selectedSize, setSelectedSize] = useState(
    product.sizes.find((s) => s.inStock) || product.sizes[0]
  );
  const [qty, setQty] = useState(1);

  const currentImage = selectedSize.image || product.image;

  const buyNow = () => {
    addItem(product.id, selectedSize.sku, qty);
    router.push("/checkout");
  };

  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-2">
      {/* Gallery & Photo Selector */}
      <div className="flex flex-col gap-4">
        <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-5xl bg-gradient-to-b from-honey-100 to-parchment p-8 sm:p-10">
          <div className="absolute left-5 top-5 flex flex-wrap gap-1.5 z-10">
            {product.labels.map((l) => (
              <span
                key={l}
                className="rounded-full bg-charcoal px-3 py-1 text-[10px] font-bold tracking-wider text-cream"
              >
                {l}
              </span>
            ))}
          </div>
          <svg
            aria-hidden
            className="absolute h-[300px] w-[300px] animate-spin-slow text-honey-400/40 sm:h-[360px] sm:w-[360px]"
            viewBox="0 0 100 100"
            fill="none"
          >
            <circle
              cx="50"
              cy="50"
              r="47"
              stroke="currentColor"
              strokeWidth="0.6"
              strokeDasharray="1 3"
            />
          </svg>
          <div className="relative z-10 flex items-center justify-center transition-all duration-300">
            {currentImage ? (
              <img
                key={currentImage}
                src={currentImage}
                alt={`${product.name} ${selectedSize.weight}`}
                className="h-[280px] max-w-full object-contain drop-shadow-xl transition-all duration-300 hover:scale-105"
              />
            ) : (
              <JarVisual tone={product.jarTone} label={product.honeyType} size={260} />
            )}
          </div>
          <div aria-hidden className="absolute right-6 top-10 animate-wobble">
            <BeeCharacter size={58} />
          </div>
        </div>

        {/* Jar Photo Thumbnails / Size Quick Switch */}
        <div className="flex justify-center gap-4">
          {product.sizes.map((s) => {
            const isSelected = selectedSize.sku === s.sku;
            const img = s.image || product.image;
            return (
              <button
                key={s.sku}
                onClick={() => setSelectedSize(s)}
                className={`group flex items-center gap-3 rounded-2xl border p-2.5 transition ${
                  isSelected
                    ? "border-honey-600 bg-honey-50 ring-2 ring-honey-500/30"
                    : "border-charcoal/10 bg-white hover:border-honey-300"
                }`}
              >
                <div className="h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-honey-100/50 p-1">
                  <img
                    src={img}
                    alt={`${s.weight} jar`}
                    className="h-full w-full object-contain drop-shadow-sm transition group-hover:scale-110"
                  />
                </div>
                <div className="pr-2 text-left">
                  <p className="text-xs font-bold text-charcoal">{s.weight} Jar</p>
                  <p className="text-[11px] font-semibold text-honey-700">{formatPrice(s.price)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Purchase Details Panel */}
      <div>
        <p className="eyebrow">{product.honeyType} honey · {product.origin}</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">{product.name}</h1>
        <p className="mt-4 leading-relaxed text-charcoal-mute">{product.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.character.map((c) => (
            <span
              key={c}
              className="rounded-full bg-forest-pale px-3 py-1.5 text-xs font-semibold text-forest"
            >
              {c}
            </span>
          ))}
        </div>

        {/* Size Selection */}
        <div className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">
            Select Jar Size
          </p>
          <div className="mt-2 flex gap-3">
            {product.sizes.map((s) => (
              <button
                key={s.sku}
                onClick={() => setSelectedSize(s)}
                disabled={!s.inStock}
                className={`flex flex-col items-center min-w-[100px] rounded-2xl border px-5 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                  selectedSize.sku === s.sku
                    ? "border-charcoal bg-charcoal text-cream shadow-md"
                    : "border-charcoal/20 bg-white text-charcoal hover:border-charcoal"
                }`}
              >
                <span className="block text-base font-bold">{s.weight}</span>
                <span className="block text-xs opacity-80">{formatPrice(s.price)}</span>
              </button>
            ))}
          </div>

          {/* Quantity & Price */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-charcoal/20 bg-white">
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
            <p className="font-display text-3xl">{formatPrice(selectedSize.price * qty)}</p>
            <p
              className={`text-xs font-semibold ${
                selectedSize.inStock ? "text-forest" : "text-red-600"
              }`}
            >
              {selectedSize.inStock ? "In stock" : "Out of stock"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-charcoal/10 bg-cream/95 p-3 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
            <button
              onClick={() => addItem(product.id, selectedSize.sku, qty)}
              disabled={!selectedSize.inStock}
              className="btn-primary disabled:opacity-40"
            >
              Add to Cart
            </button>
            <button
              onClick={buyNow}
              disabled={!selectedSize.inStock}
              className="btn-dark disabled:opacity-40"
            >
              Buy Now
            </button>
          </div>
          <div className="h-16 sm:hidden" aria-hidden />
        </div>
      </div>
    </div>
  );
}
