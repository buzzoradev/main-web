import TrackOrder from "@/components/TrackOrder";

export const metadata = {
  title: "Track Your Order | Buzzora Raw Honey",
  description:
    "Check live delivery status, shipment progress, and courier tracking information for your Buzzora raw honey order.",
};

export default function TrackOrderPage() {
  return (
    <main className="min-h-screen bg-cream pt-24 pb-16">
      <TrackOrder />
    </main>
  );
}
