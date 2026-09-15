// The Honey Journal — educational articles mirroring the themes Buzzora
// already covers on Instagram. Copy is educational and general; it makes no
// medical claims and no invented statistics.

export const articles = [
  {
    slug: "what-is-multiflora-honey",
    title: "What is Multiflora Honey?",
    excerpt:
      "One jar, many flowers. How bees compose a honey that tastes like an entire valley in bloom.",
    tone: "#D99A34",
    body: [
      "Multiflora honey is exactly what the name suggests: honey made from the nectar of many different flowers rather than a single dominant bloom.",
      "When hives sit in a region as florally diverse as Jammu & Kashmir, bees forage across whatever is flowering — wildflowers, herbs, blossoming trees. The nectar they gather blends naturally inside the hive.",
      "That is why multiflora honey varies between harvests and between valleys. It is not an inconsistency; it is a signature. Each jar reflects a particular place and a particular season.",
      "If a single-origin honey is like a varietal, multiflora is the field blend — composed not by people, but by the bees themselves.",
    ],
  },
  {
    slug: "what-makes-raw-honey-different",
    title: "What makes raw honey different?",
    excerpt:
      "Nothing added, nothing taken away — what 'raw' actually means, and why it matters for flavour.",
    tone: "#C98A2B",
    body: [
      "Raw honey is honey as it exists in the hive. It is extracted, strained to remove wax and debris, and jarred — and that is where the process ends.",
      "Much commercial honey is heated to high temperatures and finely filtered so it stays uniformly clear on a shelf for years. That processing changes the honey's natural character.",
      "Raw honey keeps its natural aroma, texture and complexity. It may crystallise over time — a natural behaviour of real honey, not a flaw. Gently warming the jar in warm water brings it back to liquid.",
      "At Buzzora, this is the whole philosophy in one line: from hive to jar, nothing added, nothing taken away.",
    ],
  },
  {
    slug: "from-flower-to-hive",
    title: "From flower to hive",
    excerpt:
      "The journey of a single drop of nectar, from a Himalayan wildflower to the honeycomb.",
    tone: "#7A8B5E",
    body: [
      "Every jar of honey begins as nectar — a thin, sweet liquid that flowers produce to attract pollinators.",
      "A forager bee visits hundreds of flowers on a single trip, drawing nectar and carrying it back to the hive. There, it is passed between bees, and the colony gradually reduces its moisture by fanning it with their wings.",
      "When the moisture is low enough, the bees cap the cell with wax. Capped honeycomb is nature's way of saying the honey is ready.",
      "Beekeepers read those caps. Harvesting capped frames — and leaving the colony plenty for itself — is the foundation of ethical honey.",
    ],
  },
  {
    slug: "how-honey-is-harvested",
    title: "How honey is harvested",
    excerpt: "Capped frames, careful hands, and why patience is the beekeeper's main tool.",
    tone: "#8A5A1E",
    body: [
      "Harvest starts at the hive, with the beekeeper checking frames for capped honeycomb — the sign that the bees have finished their work.",
      "Only well-capped frames are taken, and always with enough honey left behind to keep the colony strong. The bees come first; the harvest is a share, not a taking.",
      "The frames are uncapped and the honey is extracted, usually by spinning the frames so the honey leaves the comb intact. The comb goes back to the hive for the bees to refill.",
      "The honey is then strained to remove wax and debris — nothing more — and jarred. From hive to jar, the path is deliberately short.",
    ],
  },
  {
    slug: "meet-the-bees",
    title: "Meet the bees",
    excerpt: "A hive is a superorganism — tens of thousands of individuals working as one.",
    tone: "#5C6B45",
    body: [
      "A healthy hive holds tens of thousands of bees, each with a role: foragers who gather nectar and pollen, house bees who process and store it, guards at the entrance, and a single queen laying the eggs that keep the colony alive.",
      "Bees are also pollinators. As they forage across the valleys, they carry pollen from flower to flower — the flora feeds the bees, and the bees sustain the flora.",
      "Caring for bees means keeping hives in clean, flowering landscapes, handling colonies gently, and never taking more honey than the hive can spare.",
      "When you choose ethically kept honey, you support that whole cycle — the bees, the beekeepers, and the landscapes they depend on.",
    ],
  },
];

export function getArticle(slug) {
  return articles.find((a) => a.slug === slug);
}
