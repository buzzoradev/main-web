"use client";

import Link from "next/link";
import { useCart } from "@/components/CartContext";
import { formatPrice, minPrice } from "@/lib/products";
import JarVisual from "@/components/JarVisual";

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const defaultSize = product.sizes.find((s) => s.inStock) || product.sizes[0];

  return (
    <div className="group flex flex-col overflow-hidden rounded-4xl border border-charcoal/10 bg-white shadow-soft transition hover:shadow-lifted">
      <Link
        href={`/products/${product.slug}`}
        className="relative flex items-center justify-center bg-gradient-to-b from-honey-50 to-parchment px-6 pb-4 pt-8"
      >
        <div className="flex h-[204px] items-center justify-center transition duration-500 group-hover:-translate-y-1.5 group-hover:scale-[1.03]">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-auto max-h-[204px] object-contain drop-shadow-md"
            />
          ) : (
            <JarVisual tone={product.jarTone} label={product.honeyType} size={170} />
          )}
        </div>
        <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          {product.labels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-charcoal px-2.5 py-1 text-[10px] font-bold tracking-wider text-cream"
            >
              {l}
            </span>
          ))}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider2 text-forest">
          {product.honeyType} · {product.origin}
        </p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="mt-1.5 font-display text-2xl transition group-hover:text-honey-700">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-charcoal-mute">
          {product.tagline}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-charcoal-mute">from</p>
            <p className="font-display text-xl">{formatPrice(minPrice(product))}</p>
          </div>
          <p className="text-xs text-charcoal-mute">
            {product.sizes.map((s) => s.weight).join(" / ")}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => addItem(product.id, defaultSize.sku)}
            disabled={!defaultSize.inStock}
            className="rounded-full bg-accent-400 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-accent-500 disabled:opacity-40"
          >
            Add to Cart
          </button>
          <Link
            href={`/products/${product.slug}`}
            className="rounded-full border border-charcoal/20 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest transition hover:bg-charcoal hover:text-cream"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
