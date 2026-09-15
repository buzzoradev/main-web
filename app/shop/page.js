import ShopGrid from "@/components/ShopGrid";

export const metadata = {
  title: "Shop Raw Honey",
  description:
    "Shop Buzzora's raw honey — Wild Tulsi and Multiflora — ethically sourced from the valleys of Jammu & Kashmir.",
};

export default function ShopPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 md:pt-32">
      <p className="eyebrow">Shop</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Raw honey, from J&amp;K</h1>
      <p className="mt-3 max-w-xl text-charcoal-mute">
        Every jar is raw and unprocessed — from hive to jar, nothing added, nothing taken
        away.
      </p>
      <ShopGrid />
    </main>
  );
}
