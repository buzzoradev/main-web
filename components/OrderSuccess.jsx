"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/products";
import BeeCharacter from "@/components/BeeCharacter";

export default function OrderSuccess() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const [order, setOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("buzzora-last-order") || "null");
      if (saved && saved.id === orderId) setOrder(saved);
    } catch {}
    setLoaded(true);
  }, [orderId]);

  if (!loaded) return null;

  return (
    <div className="text-center">
      <div className="mx-auto flex w-fit animate-wobble justify-center">
        <BeeCharacter size={92} />
      </div>
      <span className="sticker mt-4">🎉 Order placed!</span>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Your honey is on its way.</h1>
      <p className="mt-3 text-charcoal-mute">
        {order?.status === "paid" ? (
          <>
            Thank you{order ? `, ${order.customer.name.split(" ")[0]}` : ""}! Your payment was
            received and your order is confirmed.
          </>
        ) : order?.paymentMethod === "whatsapp" ? (
          <>
            Thank you{order ? `, ${order.customer.name.split(" ")[0]}` : ""}! Your order is
            ready in WhatsApp — send us the message to confirm and we&apos;ll arrange payment
            and delivery. Didn&apos;t see WhatsApp open? Your order is saved below.
          </>
        ) : (
          <>
            Thank you{order ? `, ${order.customer.name.split(" ")[0]}` : ""}! We&apos;ve
            received your order and the Buzzora team will confirm it shortly.
          </>
        )}
      </p>

      {orderId && (
        <p className="mt-6 inline-block rounded-full bg-honey-100 px-5 py-2 text-sm font-bold tracking-wider">
          Order {orderId}
        </p>
      )}

      {order && (
        <div className="mt-8 rounded-4xl border border-charcoal/10 bg-white p-6 text-left sm:p-8">
          <h2 className="font-display text-2xl">Order details</h2>
          <ul className="mt-4 space-y-2 border-b border-charcoal/10 pb-4 text-sm">
            {order.lines.map((l) => (
              <li key={l.sku} className="flex justify-between">
                <span>
                  {l.name} · {l.weight} × {l.qty}
                </span>
                <span className="font-semibold">{formatPrice(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between font-display text-xl">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          {order.shippingAddress && (
            <div className="mt-5 text-sm text-charcoal-mute">
              <p className="text-xs font-semibold uppercase tracking-wider2">Shipping to</p>
              <p className="mt-1.5">
                {order.shippingAddress.address}, {order.shippingAddress.city},{" "}
                {order.shippingAddress.state} {order.shippingAddress.postcode},{" "}
                {order.shippingAddress.country}
              </p>
            </div>
          )}
          <p className="mt-5 text-sm text-charcoal-mute">
            Estimated delivery and payment details will be confirmed with you directly. For
            any questions, message us on Instagram{" "}
            <a
              href="https://www.instagram.com/_buzzora_/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-honey-700"
            >
              @_buzzora_
            </a>
            .
          </p>
        </div>
      )}

      <Link href="/shop" className="btn-primary mt-10">
        Continue Shopping
      </Link>
    </div>
  );
}
