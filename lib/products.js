// ---------------------------------------------------------------------------
// Buzzora product catalogue.
//
// PLACEHOLDER DATA: prices, weights, stock and SKUs below are placeholders and
// must be replaced with real values by the business before launch. Origin is
// kept at region level (Jammu & Kashmir) — do not add exact locations,
// certifications or health claims unless the business verifies them.
// ---------------------------------------------------------------------------

export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";

export const products = [
  {
    id: "wild-tulsi",
    slug: "wild-tulsi-honey",
    name: "Wild Tulsi Honey",
    image: "/product images/wild tulsi 01.png",
    honeyType: "Wild Tulsi",
    category: "raw-honey",
    origin: "Jammu & Kashmir",
    tagline: "Floral and aromatic, gathered from hives surrounded by wild tulsi flora.",
    description:
      "Raw honey gathered from hives surrounded by wild tulsi flora in the valleys of Jammu & Kashmir. Nothing added, nothing taken away — the honey goes from hive to jar as the bees made it.",
    character: ["Floral", "Aromatic", "Distinctive"],
    labels: ["RAW", "UNPROCESSED", "FROM J&K"],
    special:
      "Wild tulsi grows freely across the valleys where our hives sit. The bees forage on it through the flowering season, and that flora shapes the aroma and character of this honey.",
    howToEnjoy: [
      "Stirred into warm (not boiling) water or milk",
      "Drizzled over toast, parathas or porridge",
      "A spoonful on its own",
      "As a natural sweetener in place of refined sugar",
    ],
    // PLACEHOLDER sizes & prices — replace with real values.
    sizes: [
      { weight: "250g", price: 349, sku: "BZ-WT-250", inStock: true },
      { weight: "500g", price: 649, sku: "BZ-WT-500", inStock: true },
    ],
    featured: true,
    accent: "#C98A2B",
    jarTone: "#D99A34",
  },
  {
    id: "multiflora",
    slug: "multiflora-honey",
    name: "Multiflora Honey",
    image: "/product images/sulai.png",
    honeyType: "Multiflora",
    category: "raw-honey",
    origin: "Jammu & Kashmir",
    tagline: "Rich and complex, reflecting the diverse floral landscape of the Himalayan region.",
    description:
      "Raw honey reflecting the diverse floral landscape of the Himalayan region. Bees forage across many wildflowers, and every harvest carries the character of the valley it came from.",
    character: ["Rich", "Complex", "Everyday"],
    labels: ["RAW", "UNPROCESSED", "FROM J&K"],
    special:
      "No two valleys flower the same way. Multiflora honey is the taste of that diversity — a blend composed by the bees themselves as they move between wildflowers across the season.",
    howToEnjoy: [
      "Your everyday honey — tea, breakfast, cooking",
      "Paired with cheese, fruit and nuts",
      "In dressings and marinades",
      "Straight from the jar",
    ],
    // PLACEHOLDER sizes & prices — replace with real values.
    sizes: [
      { weight: "250g", price: 299, sku: "BZ-MF-250", inStock: true },
      { weight: "500g", price: 549, sku: "BZ-MF-500", inStock: true },
    ],
    featured: true,
    accent: "#8A5A1E",
    jarTone: "#B77B22",
  },
];

export function getProduct(slug) {
  return products.find((p) => p.slug === slug);
}

export function relatedProducts(slug) {
  return products.filter((p) => p.slug !== slug);
}

export function formatPrice(amount) {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString("en-IN")}`;
}

export function minPrice(product) {
  return Math.min(...product.sizes.map((s) => s.price));
}
