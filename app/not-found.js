import Link from "next/link";
import BeeCharacter from "@/components/BeeCharacter";

export const metadata = {
  title: "Page Not Found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 pb-20 pt-28 text-center sm:px-6 md:pt-36">
      <div className="relative mb-6 animate-floaty">
        <BeeCharacter size={120} flap={true} expression="wink" />
      </div>

      <p className="eyebrow text-honey-700">404 Error</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl text-charcoal">
        Page not found
      </h1>

      <p className="mt-4 max-w-md text-base leading-relaxed text-charcoal-mute">
        The page you are looking for doesn&apos;t exist, has been moved, or has flown away to the flower fields.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/shop" className="btn-primary">
          Shop Raw Honey
        </Link>
        <Link href="/" className="btn-dark">
          Back to Home
        </Link>
        <Link href="/track-order" className="btn-ghost">
          Track an Order
        </Link>
      </div>
    </main>
  );
}
