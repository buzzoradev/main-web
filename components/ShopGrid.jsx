"use client";

import { useMemo, useState } from "react";
import { products, minPrice } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

const honeyTypes = ["All", ...new Set(products.map((p) => p.honeyType))];

const sorts = {
  featured: { label: "Featured", fn: (a, b) => Number(b.featured) - Number(a.featured) },
  "price-asc": { label: "Price: Low to High", fn: (a, b) => minPrice(a) - minPrice(b) },
  "price-desc": { label: "Price: High to Low", fn: (a, b) => minPrice(b) - minPrice(a) },
};

export default function ShopGrid() {
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("featured");

  const shown = useMemo(() => {
    const filtered = type === "All" ? [...products] : products.filter((p) => p.honeyType === type);
    return filtered.sort(sorts[sort].fn);
  }, [type, sort]);

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {honeyTypes.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
                type === t
                  ? "bg-charcoal text-cream"
                  : "border border-charcoal/20 text-charcoal hover:border-charcoal"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-charcoal-mute">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-full border border-charcoal/20 bg-white px-3 py-2 text-xs font-semibold text-charcoal outline-none focus:border-honey-500"
          >
            {Object.entries(sorts).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:max-w-3xl">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {shown.length === 0 && (
        <p className="mt-12 text-center text-charcoal-mute">No honey matches that filter.</p>
      )}
    </>
  );
}
