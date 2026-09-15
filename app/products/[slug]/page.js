import { notFound } from "next/navigation";
import Link from "next/link";
import { products, getProduct, relatedProducts, minPrice, CURRENCY } from "@/lib/products";
import ProductPurchase from "@/components/ProductPurchase";
import ProductCard from "@/components/ProductCard";
import JarVisual from "@/components/JarVisual";
import BeeCharacter from "@/components/BeeCharacter";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }) {
  const product = getProduct(params.slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
  };
}

export default function ProductPage({ params }) {
  const product = getProduct(params.slug);
  if (!product) notFound();
  const related = relatedProducts(params.slug);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: "Buzzora" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: CURRENCY,
      lowPrice: minPrice(product),
      highPrice: Math.max(...product.sizes.map((s) => s.price)),
      availability: product.sizes.some((s) => s.inStock)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const sections = [
    { title: "What makes this honey special?", body: product.special },
    {
      title: "Where does it come from?",
      body: `Our hives sit in the serene valleys of ${product.origin}. The local flora the bees forage on shapes everything about this honey — its aroma, colour and character.`,
    },
    {
      title: "From hive to jar",
      body: "Harvested from well-capped frames, extracted, strained to remove wax, and jarred. No heating to high temperatures, no blending, no additives. Raw honey may crystallise naturally over time — warm the jar gently in warm water to bring it back to liquid.",
    },
    {
      title: "Shipping information",
      body: "Orders are packed carefully to protect the glass jar in transit. Shipping timelines and charges are shown at checkout.",
    },
    {
      title: "Returns",
      body: "If your order arrives damaged, contact us with a photo and we'll make it right. Reach us via WhatsApp or Instagram @_buzzora_.",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 md:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <nav className="text-xs text-charcoal-mute">
        <Link href="/" className="hover:text-honey-700">Home</Link>
        {" / "}
        <Link href="/shop" className="hover:text-honey-700">Shop</Link>
        {" / "}
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div className="relative flex items-center justify-center overflow-hidden rounded-5xl bg-gradient-to-b from-honey-100 to-parchment p-10">
          <div className="absolute left-5 top-5 flex flex-wrap gap-1.5">
            {product.labels.map((l) => (
              <span key={l} className="rounded-full bg-charcoal px-3 py-1 text-[10px] font-bold tracking-wider text-cream">
                {l}
              </span>
            ))}
          </div>
          <svg aria-hidden className="absolute h-[300px] w-[300px] animate-spin-slow text-honey-400/40 sm:h-[360px] sm:w-[360px]" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="47" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 3" />
          </svg>
          <div className="relative animate-floaty">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-[260px] max-w-full object-contain drop-shadow-xl"
              />
            ) : (
              <JarVisual tone={product.jarTone} label={product.honeyType} size={260} />
            )}
          </div>
          <div aria-hidden className="absolute right-6 top-10 animate-wobble">
            <BeeCharacter size={58} />
          </div>
        </div>

        {/* Purchase panel */}
        <div>
          <p className="eyebrow">{product.honeyType} honey · {product.origin}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{product.name}</h1>
          <p className="mt-4 leading-relaxed text-charcoal-mute">{product.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {product.character.map((c) => (
              <span key={c} className="rounded-full bg-forest-pale px-3 py-1.5 text-xs font-semibold text-forest">
                {c}
              </span>
            ))}
          </div>
          <ProductPurchase product={product} />
        </div>
      </div>

      {/* Detail sections */}
      <div className="mx-auto mt-16 max-w-3xl space-y-4">
        {sections.map((s) => (
          <details key={s.title} className="group rounded-3xl border border-charcoal/10 bg-white p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between font-display text-xl">
              {s.title}
              <span className="text-honey-600 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-charcoal-mute">{s.body}</p>
          </details>
        ))}
        <details className="group rounded-3xl border border-charcoal/10 bg-white p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between font-display text-xl">
            How to enjoy it
            <span className="text-honey-600 transition group-open:rotate-45">+</span>
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-charcoal-mute">
            {product.howToEnjoy.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </details>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-center font-display text-3xl sm:text-4xl">You may also like</h2>
          <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
