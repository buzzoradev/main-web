import { Suspense } from "react";
import OrderSuccess from "@/components/OrderSuccess";

export const metadata = {
  title: "Order Confirmed",
  robots: { index: false },
};

export default function OrderSuccessPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 md:pt-32">
      <Suspense>
        <OrderSuccess />
      </Suspense>
    </main>
  );
}
