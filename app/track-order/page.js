import { Suspense } from "react";
import TrackOrder from "@/components/TrackOrder";
import BeeCharacter from "@/components/BeeCharacter";

export const metadata = {
  title: "Track Your Order | Buzzora Raw Honey",
  description:
    "Check live delivery status, shipment progress, and courier tracking information for your Buzzora raw honey order.",
};

function TrackOrderFallback() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto flex w-fit animate-wobble justify-center">
        <BeeCharacter size={64} />
      </div>
      <p className="mt-4 text-charcoal-mute">Loading tracking portal…</p>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <main className="min-h-screen bg-cream pt-24 pb-16">
      <Suspense fallback={<TrackOrderFallback />}>
        <TrackOrder />
      </Suspense>
    </main>
  );
}

