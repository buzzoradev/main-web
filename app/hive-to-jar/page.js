import Link from "next/link";
import HiveTimeline, { hiveSteps } from "@/components/HiveTimeline";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "From Hive to Jar",
  description:
    "Follow the full journey of Buzzora raw honey — from Himalayan wildflowers and bees to the jar on your table. Nothing added, nothing taken away.",
};

export default function HiveToJarPage() {
  return (
    <main className="pb-20 pt-24 md:pt-32">
      <section className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="eyebrow">The journey</p>
          <h1 className="mt-3 font-display text-5xl sm:text-6xl">From hive to jar</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-charcoal-mute">
            Seven steps stand between a Himalayan wildflower and your table. Here is every one
            of them — because a jar of honey should have nothing to hide.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto mt-14 max-w-4xl px-4 sm:px-6">
        <HiveTimeline steps={hiveSteps} />
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4 sm:px-6">
        <Reveal>
          <div className="rounded-5xl bg-honey-400 p-8 text-center sm:p-12">
            <h2 className="font-display text-3xl sm:text-4xl">That&apos;s the whole process.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal/80">
              No heating to high temperatures. No blending. No additives. If it&apos;s not on
              this page, we don&apos;t do it.
            </p>
            <Link href="/shop" className="btn-dark mt-7">
              Shop Raw Honey
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
