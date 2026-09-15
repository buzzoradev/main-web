"use client";

import { useState } from "react";
import Link from "next/link";
import { products } from "@/lib/products";
import JarVisual from "@/components/JarVisual";

// One-question product finder — reduces decision fatigue without a long quiz.
const options = [
  { label: "Something floral & aromatic", emoji: "🌸", pick: "wild-tulsi" },
  { label: "Something rich & complex", emoji: "🍂", pick: "multiflora" },
  { label: "Something mild & everyday", emoji: "☕", pick: "multiflora" },
  { label: "I want to explore", emoji: "🧭", pick: "wild-tulsi" },
];

export default function HoneyQuiz() {
  const [picked, setPicked] = useState(null);
  const product = picked ? products.find((p) => p.id === picked.pick) : null;

  return (
    <div className="mx-auto max-w-3xl rounded-5xl border border-charcoal/10 bg-white p-6 shadow-soft sm:p-10">
      {!product ? (
        <>
          <p className="eyebrow text-center">Find your honey</p>
          <h3 className="mt-2 text-center font-display text-3xl sm:text-4xl">
            What kind of honey are you looking for?
          </h3>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {options.map((o) => (
              <button
                key={o.label}
                onClick={() => setPicked(o)}
                className="flex items-center gap-3 rounded-2xl border border-charcoal/15 px-5 py-4 text-left text-sm font-semibold transition hover:border-honey-500 hover:bg-honey-50"
              >
                <span className="text-xl">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div className="shrink-0 rounded-3xl bg-honey-50 p-4">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-[120px] w-auto max-h-[120px] object-contain drop-shadow-md"
              />
            ) : (
              <JarVisual tone={product.jarTone} label={product.honeyType} size={120} />
            )}
          </div>
          <div>
            <p className="eyebrow">We&apos;d recommend</p>
            <h3 className="mt-1 font-display text-3xl">{product.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-mute">{product.tagline}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Link href={`/products/${product.slug}`} className="btn-primary">
                View this honey
              </Link>
              <button onClick={() => setPicked(null)} className="btn-ghost">
                Ask me again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
