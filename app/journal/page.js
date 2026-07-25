import Link from "next/link";
import { articles } from "@/lib/articles";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "The Honey Journal",
  description:
    "Honey education from Buzzora — raw honey, multiflora, harvesting, and the bees behind every jar.",
};

export default function JournalPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 md:pt-32">
      <p className="eyebrow">The Honey Journal</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Learn your honey</h1>
      <p className="mt-3 max-w-xl text-charcoal-mute">
        The more you know about how honey is made, the more you&apos;ll taste in every jar.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <Reveal key={a.slug} delay={i * 60}>
            <Link
              href={`/journal/${a.slug}`}
              className="group block h-full rounded-3xl border border-charcoal/10 bg-white p-6 shadow-soft transition hover:shadow-lifted"
            >
              <div
                className="flex h-32 items-center justify-center rounded-2xl text-5xl"
                style={{ backgroundColor: `${a.tone}22` }}
              >
                🍯
              </div>
              <h2 className="mt-4 font-display text-2xl transition group-hover:text-honey-700">
                {a.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-mute">{a.excerpt}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-honey-700">
                Read article →
              </p>
            </Link>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
