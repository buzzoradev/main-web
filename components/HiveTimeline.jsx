import Reveal from "@/components/Reveal";
import BeeCharacter from "@/components/BeeCharacter";

// Signature "From Hive to Jar" visual timeline.
export default function HiveTimeline({ steps, dark = false }) {
  return (
    <ol className="relative mx-auto max-w-2xl">
      <div
        aria-hidden
        className={`absolute left-[27px] top-6 h-[calc(100%-3rem)] w-px sm:left-1/2 ${
          dark ? "bg-cream/20" : "bg-honey-300/60"
        }`}
      />
      {/* Buzz rides the journey from the top */}
      <div aria-hidden className="absolute left-[27px] -top-6 z-20 animate-floaty sm:left-1/2 sm:-translate-x-1/2">
        <BeeCharacter size={46} />
      </div>
      {steps.map((step, i) => (
        <li key={step.title} className="relative py-5">
          <Reveal delay={i * 60}>
            <div
              className={`group flex items-start gap-5 sm:gap-8 ${
                i % 2 === 1 ? "sm:flex-row-reverse sm:text-right" : ""
              }`}
            >
              <div
                className={`z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl shadow-soft transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 sm:absolute sm:left-1/2 sm:-translate-x-1/2 ${
                  dark ? "bg-honey-400" : "bg-white ring-2 ring-honey-300 group-hover:ring-accent-300"
                }`}
              >
                {step.emoji}
              </div>
              <div className={`sm:w-[calc(50%-3.5rem)] ${i % 2 === 1 ? "sm:mr-auto" : "sm:ml-auto"}`}>
                <p className={`text-xs font-bold tracking-wider2 ${dark ? "text-honey-300" : "text-accent-500"}`}>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1 font-display text-2xl">{step.title}</h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${dark ? "text-cream/70" : "text-charcoal-mute"}`}>
                  {step.text}
                </p>
              </div>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

export const hiveSteps = [
  {
    emoji: "🌼",
    title: "Flower",
    text: "It starts with the wild flora of the J&K valleys — tulsi, wildflowers and blossoming trees.",
  },
  {
    emoji: "🐝",
    title: "Bee",
    text: "Forager bees gather nectar across the valley, flower by flower, trip after trip.",
  },
  {
    emoji: "🛖",
    title: "Hive",
    text: "Inside the hive, the colony transforms nectar into honey and caps it in wax when it's ready.",
  },
  {
    emoji: "🧑‍🌾",
    title: "Harvest",
    text: "Beekeepers take only well-capped frames, always leaving the colony plenty for itself.",
  },
  {
    emoji: "🍯",
    title: "Extraction",
    text: "The honey is spun from the comb and strained to remove wax — nothing more.",
  },
  {
    emoji: "🫙",
    title: "Jar",
    text: "Raw honey is jarred as-is. No heating it to death, no blending, no additives.",
  },
  {
    emoji: "🏡",
    title: "Your Table",
    text: "From a Himalayan valley to your home — with nothing added and nothing taken away.",
  },
];
