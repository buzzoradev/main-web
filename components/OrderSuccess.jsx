"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/products";
import { useCart } from "@/components/CartContext";
import BeeCharacter from "@/components/BeeCharacter";

export default function OrderSuccess() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const vt = params.get("vt");
  const { clearCart } = useCart();

  const [order, setOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      setLoaded(true);
      return;
    }

    let isMounted = true;

    async function loadServerOrder() {
      try {
        const queryVt = vt ? `?vt=${encodeURIComponent(vt)}` : "";
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}${queryVt}`);
        
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.order) {
            setOrder(data.order);
            // Safely clear cart ONLY when server confirms order status is CONFIRMED or paid
            if (data.order.status === "CONFIRMED" || data.order.status === "paid") {
              clearCart();
            }
            setLoaded(true);
            return;
          }
        } else if (res.status === 401) {
          // Token missing, invalid, or expired
          if (isMounted) {
            setError("UNAUTHORIZED");
            setLoaded(true);
          }
          return;
        } else if (res.status === 404) {
          if (isMounted) {
            setError("NOT_FOUND");
            setLoaded(true);
          }
          return;
        }
      } catch (err) {
        console.warn("[OrderSuccess] Could not load server order:", err.message);
      }

      // Fallback to transient sessionStorage data ONLY if matching current order AND no server auth rejection
      try {
        const saved = JSON.parse(sessionStorage.getItem("buzzora-last-order") || "null");
        if (isMounted && saved && saved.id === orderId) {
          setOrder(saved);
          // Never trust unverified client-side status for cart clearing unless confirmed
          if (saved.status === "CONFIRMED" || saved.status === "paid") {
            clearCart();
          }
        }
      } catch {}

      if (isMounted) setLoaded(true);
    }

    loadServerOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, vt, clearCart]);

  if (!loaded) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto flex w-fit animate-wobble justify-center">
          <BeeCharacter size={64} />
        </div>
        <p className="mt-4 text-charcoal-mute">Verifying your order details…</p>
      </div>
    );
  }

  // 1. Unauthorized / Unverified Order Access
  if (error === "UNAUTHORIZED") {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex w-fit animate-wobble justify-center">
          <BeeCharacter size={92} />
        </div>
        <span className="sticker mt-4 bg-amber-100 text-amber-800">🔒 Verification Required</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl">Order Verification Required</h1>
        <p className="mx-auto mt-3 max-w-md text-charcoal-mute">
          To protect your privacy and personal data, order details are only accessible via a verified order link or by verifying your contact information.
        </p>
        {orderId && (
          <p className="mt-5 inline-block rounded-full bg-honey-100 px-5 py-2 text-sm font-bold tracking-wider">
            Order {orderId}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/track-order?orderId=${encodeURIComponent(orderId)}`}
            className="btn-primary"
          >
            Verify & Track Order
          </Link>
          <Link href="/" className="btn-ghost">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // 2. Order Not Found
  if (error === "NOT_FOUND" && !order) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex w-fit animate-wobble justify-center">
          <BeeCharacter size={92} />
        </div>
        <span className="sticker mt-4 bg-rose-100 text-rose-800">Order Not Found</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl">We couldn&apos;t find this order</h1>
        <p className="mx-auto mt-3 max-w-md text-charcoal-mute">
          The requested order ID does not exist or may have been entered incorrectly.
        </p>
        <div className="mt-8">
          <Link href="/" className="btn-primary">
            Return to Store
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmed = order?.status === "CONFIRMED" || order?.status === "paid";
  const isPending = order?.status === "PENDING";
  const isWhatsApp = order?.paymentMethod === "whatsapp";

  return (
    <div className="text-center">
      <div className="mx-auto flex w-fit animate-wobble justify-center">
        <BeeCharacter size={92} />
      </div>

      {isConfirmed ? (
        <>
          <span className="sticker mt-4 bg-emerald-100 text-emerald-800">🎉 Payment Successful</span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl">Your order has been placed!</h1>
          <p className="mt-3 text-charcoal-mute max-w-lg mx-auto">
            Thank you{order?.customer?.name ? `, ${order.customer.name.split(" ")[0]}` : ""}! Your payment has been received and your order is currently being processed.
          </p>
          <p className="mt-2 text-sm text-charcoal-mute max-w-lg mx-auto">
            Once your order is shipped, we will send your tracking ID and courier details to your email.
          </p>
        </>
      ) : isPending ? (
        <>
          <span className="sticker mt-4 bg-amber-100 text-amber-800">⏳ Payment Pending</span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl">Awaiting Payment Confirmation</h1>
          <p className="mt-3 text-charcoal-mute">
            Thank you{order?.customer?.name ? `, ${order.customer.name.split(" ")[0]}` : ""}!
            We are awaiting payment confirmation from the gateway. If you have completed payment, this page will update shortly once confirmed.
          </p>
        </>
      ) : isWhatsApp ? (
        <>
          <span className="sticker mt-4">📱 WhatsApp Order</span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl">Order ready to send</h1>
          <p className="mt-3 text-charcoal-mute">
            Thank you{order?.customer?.name ? `, ${order.customer.name.split(" ")[0]}` : ""}! Your
            order is ready in WhatsApp — send us the message to confirm and we&apos;ll arrange
            payment and delivery.
          </p>
        </>
      ) : (
        <>
          <span className="sticker mt-4">Order Received</span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl">Your honey order is received.</h1>
          <p className="mt-3 text-charcoal-mute">
            Thank you{order?.customer?.name ? `, ${order.customer.name.split(" ")[0]}` : ""}!
            We&apos;ve received your order and the Buzzora team will confirm it shortly.
          </p>
        </>
      )}

      {orderId && (
        <p className="mt-6 inline-block rounded-full bg-honey-100 px-5 py-2 text-sm font-bold tracking-wider">
          Order {orderId}
        </p>
      )}

      {order && (
        <div className="mt-8 rounded-4xl border border-charcoal/10 bg-white p-6 text-left sm:p-8">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
            <h2 className="font-display text-2xl">Order details</h2>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                isConfirmed
                  ? "bg-emerald-100 text-emerald-800"
                  : isPending
                  ? "bg-amber-100 text-amber-800"
                  : "bg-honey-100 text-honey-800"
              }`}
            >
              {order.status || "PENDING"}
            </span>
          </div>
          <ul className="mt-4 space-y-2 border-b border-charcoal/10 pb-4 text-sm">
            {order.lines?.map((l) => (
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

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        {orderId && (
          <Link
            href={`/track-order?orderId=${encodeURIComponent(orderId)}${
              vt ? `&vt=${encodeURIComponent(vt)}` : ""
            }`}
            className="btn-ghost"
          >
            Track Delivery
          </Link>
        )}
        <Link href="/" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
