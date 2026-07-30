import Link from "next/link";

export const metadata = {
  title: "Policies",
  description: "Buzzora's terms, privacy, refund, return, and shipping policies.",
};

const policies = [
  ["Terms & Conditions", "/policies/terms-and-conditions", "The rules for using Buzzora.co.in and its services."],
  ["Privacy Policy", "/policies/privacy-policy", "How Buzzora collects, uses, and protects personal information."],
  ["Refund & Cancellation", "/policies/refund-cancellation", "Cancellation requests, refunds, and damaged or defective items."],
  ["Return Policy", "/policies/return-policy", "Eligibility and process for returns and exchanges."],
  ["Shipping Policy", "/policies/shipping-policy", "Shipping timelines, delivery, and shipping charges."],
];

export default function PoliciesPage() {
  return (
    <main className="bg-cream pt-32">
      <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <header className="mb-16 max-w-2xl">
          <p className="eyebrow">Buzzora</p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-charcoal sm:text-6xl">Policies</h1>
          <p className="mt-5 text-base leading-7 text-charcoal-mute">
            Choose a policy below to read the terms that apply to Buzzora.co.in and your orders.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {policies.map(([title, href, description]) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-charcoal/10 bg-white/50 p-6 transition hover:-translate-y-1 hover:border-honey-500/60 hover:bg-white"
            >
              <p className="eyebrow text-honey-700">Policy</p>
              <h2 className="mt-2 font-display text-2xl text-charcoal">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-charcoal-mute">{description}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-honey-700 transition group-hover:text-charcoal">
                Read policy →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
