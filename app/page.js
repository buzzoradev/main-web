import Link from "next/link";
import { products } from "@/lib/products";
import { articles } from "@/lib/articles";
import ProductCard from "@/components/ProductCard";
import HoneyQuiz from "@/components/HoneyQuiz";
import HiveTimeline, { hiveSteps } from "@/components/HiveTimeline";
import JarVisual from "@/components/JarVisual";
import Reveal from "@/components/Reveal";
import BeeCharacter from "@/components/BeeCharacter";

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      {/* HERO */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-gradient-to-b from-honey-100 via-honey-50 to-cream pt-24">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-honey-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-forest-pale blur-3xl"
        />
        {/* floating mascots */}
        <div aria-hidden className="pointer-events-none absolute left-6 top-28 hidden animate-floaty-slow sm:block lg:left-16">
          <BeeCharacter size={64} />
        </div>
        <div aria-hidden className="pointer-events-none absolute bottom-16 right-10 hidden animate-floaty sm:block">
          <BeeCharacter size={48} />
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="sticker">🍯 100% Raw &amp; Unprocessed</span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-ultra sm:text-6xl lg:text-7xl">
              From hive to jar.
              <br />
              <span className="text-honey-600">Nothing added.</span>
              <br />
              Nothing taken away.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-charcoal-mute lg:mx-0">
              Raw honey, ethically sourced from the serene valleys of Jammu &amp; Kashmir —
              jarred exactly as the bees made it.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href="/shop" className="btn-accent">
                Order Now 🍯
              </Link>
              <Link href="/about" className="btn-ghost">
                Discover Our Story
              </Link>
            </div>
          </div>
          <div className="relative mx-auto flex items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 m-auto h-72 w-72 rounded-full bg-honey-300/40 blur-2xl sm:h-96 sm:w-96"
            />
            {/* spinning dashed halo */}
            <svg aria-hidden className="absolute h-[360px] w-[360px] animate-spin-slow text-honey-400/50 sm:h-[430px] sm:w-[430px]" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="47" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1 3" />
            </svg>
            <div className="relative animate-floaty drop-shadow-2xl">
              <img
                src="/product images/wild tulsi 01.png"
                alt="Wild Tulsi Honey"
                className="h-[310px] sm:h-[370px] w-auto object-contain"
              />
            </div>
            <div className="absolute -right-2 top-6 animate-wobble sm:right-4" aria-hidden>
              <BeeCharacter size={72} />
            </div>
          </div>
        </div>
        {/* honey drip bottom edge */}
        <svg aria-hidden className="absolute inset-x-0 bottom-0 h-6 w-full text-cream" viewBox="0 0 1200 24" preserveAspectRatio="none" fill="currentColor">
          <path d="M0 24 V6 Q30 6 30 14 T60 14 Q90 0 120 12 T180 10 Q210 22 240 12 T300 8 Q340 20 380 10 T460 12 Q500 2 540 12 T620 10 Q660 22 700 12 T780 8 Q820 20 860 12 T940 10 Q990 0 1040 12 T1120 12 Q1160 4 1200 12 V24 Z" />
        </svg>
      </section>

      {/* PRODUCT HIGHLIGHTS */}
      <section id="our-honey" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <Reveal>
          <p className="eyebrow text-center">Our honey</p>
          <h2 className="mt-2 text-center font-display text-4xl sm:text-5xl">
            Two valleys. Two characters.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-charcoal-mute">
            Every variety is shaped by the flora the bees forage on. Choose the character that
            suits your table.
          </p>
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
          {products.map((p, i) => (
            <Reveal key={p.id} delay={i * 100}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* QUIZ */}
      <section className="bg-parchment px-4 py-20 sm:px-6">
        <Reveal>
          <HoneyQuiz />
        </Reveal>
      </section>

      {/* BRAND STATEMENT */}
      <section className="bg-charcoal px-4 py-24 text-center text-cream sm:px-6">
        <Reveal>
          <p className="font-display text-4xl leading-tight sm:text-6xl">
            No shortcuts.
            <br />
            No unnecessary processing.
            <br />
            <span className="text-honey-400">Just honey.</span>
          </p>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-cream/70 sm:text-base">
            We believe honey is already perfect when it leaves the hive. So we keep the path
            from hive to jar deliberately short: harvest, strain, jar. That&apos;s it. Raw
            honey may crystallise over time — that&apos;s nature, not a flaw.
          </p>
        </Reveal>
      </section>

      {/* STORY / TIMELINE */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="eyebrow text-center">The story behind the jar</p>
          <h2 className="mt-2 text-center font-display text-4xl sm:text-5xl">
            From hive to jar
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-charcoal-mute">
            Anyone can sell a jar of honey. We&apos;d rather show you the whole journey behind
            ours.
          </p>
        </Reveal>
        <div className="mt-12">
          <HiveTimeline steps={hiveSteps} />
        </div>
        <div className="mt-10 text-center">
          <Link href="/hive-to-jar" className="btn-ghost">
            Explore the full journey
          </Link>
        </div>
      </section>

      {/* VALLEYS OF J&K */}
      <section className="relative overflow-hidden bg-gradient-to-b from-forest-pale via-cream to-cream px-4 py-24 sm:px-6">
        <div aria-hidden className="absolute -left-20 top-10 text-8xl opacity-10">
          🏔️
        </div>
        <div aria-hidden className="absolute -right-10 bottom-10 text-8xl opacity-10">
          🌲
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow">Origin</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">
              From the valleys of Jammu &amp; Kashmir
            </h2>
            <p className="mt-6 text-base leading-relaxed text-charcoal-mute">
              Our hives sit in some of the most serene valleys in the Himalayan region, where
              wild tulsi and diverse mountain flora bloom through the seasons. What the bees
              forage on is what you taste — the landscape writes the flavour, and we just
              carry it to the jar.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-forest">
              <span className="rounded-full bg-white px-4 py-2 shadow-soft">Wild tulsi flora</span>
              <span className="rounded-full bg-white px-4 py-2 shadow-soft">Himalayan wildflowers</span>
              <span className="rounded-full bg-white px-4 py-2 shadow-soft">Ethical beekeeping</span>
              <span className="rounded-full bg-white px-4 py-2 shadow-soft">Serene valleys</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* JOURNAL */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">The Honey Journal</p>
              <h2 className="mt-2 font-display text-4xl sm:text-5xl">Learn your honey</h2>
            </div>
            <Link href="/journal" className="text-sm font-bold text-honey-700 hover:text-honey-800">
              All articles →
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {articles.slice(0, 3).map((a, i) => (
            <Reveal key={a.slug} delay={i * 80}>
              <Link
                href={`/journal/${a.slug}`}
                className="group block h-full rounded-3xl border border-charcoal/10 bg-white p-6 shadow-soft transition hover:shadow-lifted"
              >
                <div
                  className="flex h-28 items-center justify-center rounded-2xl text-4xl"
                  style={{ backgroundColor: `${a.tone}22` }}
                >
                  🍯
                </div>
                <h3 className="mt-4 font-display text-xl transition group-hover:text-honey-700">
                  {a.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-mute">{a.excerpt}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-honey-700">
                  Read article →
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className="bg-parchment px-4 py-20 text-center sm:px-6">
        <Reveal>
          <p className="eyebrow">Follow the buzz</p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">@_buzzora_</h2>
          <p className="mx-auto mt-4 max-w-md text-charcoal-mute">
            Field visits, beekeeping, honey education and life in the valleys — follow the
            journey on Instagram.
          </p>
          <a
            href="https://www.instagram.com/_buzzora_/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-dark mt-7"
          >
            Follow us on Instagram
          </a>
        </Reveal>
      </section>

      {/* WHOLESALE CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-center justify-between gap-6 rounded-5xl bg-honey-400 px-8 py-12 text-center sm:flex-row sm:text-left">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl">Looking to stock Buzzora?</h2>
              <p className="mt-2 max-w-md text-sm text-charcoal/80">
                Bulk orders, gifting and retail enquiries — we&apos;d love to hear from you.
              </p>
            </div>
            <Link href="/wholesale" className="btn-dark shrink-0">
              Wholesale Enquiries
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
