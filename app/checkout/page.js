import CheckoutForm from "@/components/CheckoutForm";

export const metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6 md:pt-32">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Almost there.</h1>
      <CheckoutForm />
    </main>
  );
}
