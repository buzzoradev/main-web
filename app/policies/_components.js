import Link from "next/link";

export function PolicyLayout({ eyebrow = "Buzzora policy", title, intro, children }) {
  return (
    <main className="bg-cream pt-32">
      <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <header className="mb-16 max-w-3xl">
          <Link href="/policies" className="eyebrow transition hover:text-honey-700">← All policies</Link>
          <p className="eyebrow mt-8 text-honey-700">{eyebrow}</p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-charcoal sm:text-6xl">{title}</h1>
          {intro && <p className="mt-5 text-base leading-7 text-charcoal-mute">{intro}</p>}
        </header>
        <div className="space-y-12">{children}</div>
      </div>
    </main>
  );
}

export function PolicySection({ title, children }) {
  return (
    <section className="border-t border-charcoal/10 pt-10 first:border-t-0 first:pt-0">
      {title && <h2 className="font-display text-3xl text-charcoal sm:text-4xl">{title}</h2>}
      <div className={`${title ? "mt-6" : ""} space-y-5 text-sm leading-7 text-charcoal-mute sm:text-base`}>
        {children}
      </div>
    </section>
  );
}

export function PolicySubheading({ children }) {
  return <h3 className="font-display text-2xl text-charcoal">{children}</h3>;
}

export function Numbered({ children }) {
  return <ol className="list-decimal space-y-4 pl-5 marker:font-semibold marker:text-honey-700">{children}</ol>;
}
