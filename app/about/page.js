import Link from "next/link";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "Our Story",
  description:
    "Meet Buzzora — founded by Kannu Priya. Raw honey ethically sourced from the valleys of Jammu & Kashmir, from hive to jar with nothing added and nothing taken away.",
};

const pillars = [
  {
    emoji: "🏔️",
    title: "Why Jammu & Kashmir",
    text: "The valleys of J&K hold some of the most diverse and unspoiled flora in the Himalayan region. Wild tulsi, wildflowers and blossoming trees give the honey a character no factory blend can imitate. Where the bees live is what you taste.",
  },
  {
    emoji: "🍯",
    title: "Why raw honey",
    text: "Most commercial honey is heated and finely filtered until it all tastes the same. Raw honey keeps its natural aroma, texture and complexity. It may crystallise over time — that's real honey behaving naturally, not a flaw.",
  },
  {
    emoji: "🐝",
    title: "Ethical sourcing",
    text: "We work with beekeepers who put the colony first: hives kept in clean, flowering landscapes, gentle handling, and harvests that always leave the bees plenty for themselves.",
  },
  {
    emoji: "🫙",
    title: "Hive to jar",
    text: "Our whole process fits in one sentence: harvest capped frames, extract, strain, jar. Nothing added, nothing taken away — the shortest honest path from the hive to your table.",
  },
];

export default function AboutPage() {
  return (
    <main className="pb-20 pt-24 md:pt-32">
      <section className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="eyebrow">Our story</p>
          <h1 className="mt-3 font-display text-5xl sm:text-6xl">Meet Buzzora</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-charcoal-mute">
            Buzzora was founded by <strong className="text-charcoal">Kannu Priya</strong> with
            a simple conviction: honey doesn&apos;t need improving. It needs protecting — from
            over-processing, from blending, from everything that happens between a good hive
            and a supermarket shelf.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div className="rounded-5xl bg-charcoal p-8 text-center text-cream sm:p-12">
            <p className="font-display text-3xl leading-snug sm:text-4xl">
              &ldquo;From hive to jar, nothing added,
              <br />
              <span className="text-honey-400">nothing taken away.&rdquo;</span>
            </p>
            <p className="mt-4 text-sm text-cream/60">The Buzzora promise</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-16 grid max-w-5xl gap-6 px-4 sm:grid-cols-2 sm:px-6">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 80}>
            <div className="h-full rounded-4xl border border-charcoal/10 bg-white p-7 shadow-soft">
              <p className="text-3xl">{p.emoji}</p>
              <h2 className="mt-3 font-display text-2xl">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-mute">{p.text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="text-base leading-relaxed text-charcoal-mute">
            Today, Buzzora shares that journey openly — field visits, beekeeping, honey
            education and every jar packed — on Instagram at{" "}
            <a
              href="https://www.instagram.com/_buzzora_/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-honey-700"
            >
              @_buzzora_
            </a>
            . The website is simply the next chapter of the same story.
          </p>
          <Link href="/shop" className="btn-dark mt-8">
            Explore Our Honey
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
