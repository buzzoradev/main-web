import WholesaleForm from "@/components/WholesaleForm";

export const metadata = {
  title: "Wholesale Enquiries",
  description:
    "Stock Buzzora raw honey — bulk orders, gifting and retail enquiries for cafés, retailers and corporate gifting.",
};

export default function WholesalePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 md:pt-32">
      <p className="eyebrow">Wholesale</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Looking to stock Buzzora?</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-charcoal-mute">
        We work with cafés, retailers, and businesses looking for bulk orders or corporate
        gifting. Tell us a little about what you need and we&apos;ll get back to you.
      </p>
      <WholesaleForm />
    </main>
  );
}
