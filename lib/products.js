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
    id: "sulai",
    slug: "sulai-honey",
    name: "Sulai Honey",
    image: "/product images/sulai 200g.png",
    honeyType: "Sulai",
    category: "raw-honey",
    origin: "Jammu & Kashmir",
    tagline: "Floral, aromatic and light amber, gathered from wild Sulai flora in Kashmir.",
    description:
      "Raw honey gathered from hives surrounded by wild Sulai (Plectranthus rugosus) flora in the serene mountain valleys of Jammu & Kashmir. Light amber, delicate in aroma, and completely raw — nothing added, nothing taken away.",
    character: ["Floral", "Aromatic", "Light Amber"],
    labels: ["RAW", "UNPROCESSED", "FROM J&K"],
    special:
      "Sulai (Plectranthus rugosus) is a wild mountain bush that flowers in the high-altitude valleys of Kashmir. Bees forage on its delicate white blossoms through late summer, producing a honey celebrated for its clear light amber color, soothing aroma, and exquisite floral notes.",
    howToEnjoy: [
      "Stirred into warm water or tea",
      "Drizzled over toast, pancakes or warm oats",
      "Paired with mild cheeses or fruit",
      "A spoonful on its own every morning",
    ],
    sizes: [
      {
        weight: "200g",
        price: 699,
        sku: "BZ-SL-200",
        image: "/product images/sulai 200g.png",
        inStock: true,
      },
      {
        weight: "500g",
        price: 999,
        sku: "BZ-SL-500",
        image: "/product images/sulai 500g.png",
        inStock: true,
      },
    ],
    featured: true,
    accent: "#C98A2B",
    jarTone: "#D99A34",
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
