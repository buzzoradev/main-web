"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { formatPrice } from "@/lib/products";
import { orderToWhatsAppText, whatsAppUrl } from "@/lib/order";
import { payWithRazorpay } from "@/lib/razorpay-client";
import { payWithPhonePe } from "@/lib/phonepe-client";
import BeeCharacter from "@/components/BeeCharacter";
import JarVisual from "@/components/JarVisual";
import GoogleSignIn from "@/components/GoogleSignIn";

const fields = [
  { name: "name", label: "Full name", autoComplete: "name", span: 2 },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  { name: "address", label: "Address", autoComplete: "street-address", span: 2 },
  { name: "city", label: "City", autoComplete: "address-level2" },
  { name: "state", label: "State", autoComplete: "address-level1" },
  { name: "postcode", label: "Postcode", autoComplete: "postal-code" },
  { name: "country", label: "Country", autoComplete: "country-name" },
];

const RAZORPAY = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === "razorpay";
const PHONEPE = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === "phonepe";
const ONLINE_PAYMENT = RAZORPAY || PHONEPE;
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export default function CheckoutForm() {
  const { items, subtotal, clearCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customer, setCustomer] = useState({ country: "India" });
  const [googleUser, setGoogleUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [existingBuzzoraOrderId, setExistingBuzzoraOrderId] = useState(null);

  const [idempotencyKey] = useState(
    () => "idem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
  );

  // Check URL query parameters for failed/pending payment return
  useEffect(() => {
    const orderParam = searchParams.get("order");
    const errorParam = searchParams.get("error");
    const statusParam = searchParams.get("status");

    if (orderParam && /^BZ-[A-Z0-9-]+$/i.test(orderParam.trim())) {
      setExistingBuzzoraOrderId(orderParam.trim());
      if (errorParam === "payment_failed") {
        setError(
          `Payment was not completed for Order ${orderParam.trim()}. Your cart and order are saved — please try paying again below.`
        );
      } else if (errorParam === "amount_mismatch") {
        setError(
          `Payment security check failed for Order ${orderParam.trim()}. Please contact support or try paying again.`
        );
      } else if (statusParam === "pending" || statusParam === "pending_verification") {
        setError(
          `Payment verification is still processing for Order ${orderParam.trim()}. If you completed payment, your order will be confirmed shortly.`
        );
      }
    }
  }, [searchParams]);

  const handleGoogleSignIn = (userInfo) => {
    setGoogleUser(userInfo);
    setCustomer((c) => ({
      ...c,
      name: userInfo.name || c.name || "",
      email: userInfo.email || c.email || "",
    }));
  };

  const handleGoogleSignOut = () => {
    setGoogleUser(null);
  };

  if (items.length === 0 && !submitting) {
    return (
      <div className="mt-10 rounded-4xl border border-charcoal/10 bg-white p-10 text-center">
        <p className="text-4xl">🫙</p>
        <p className="mt-3 font-display text-2xl">Your cart is empty</p>
        <Link href="/shop" className="btn-primary mt-6">
          Shop Raw Honey
        </Link>
      </div>
    );
  }

  const cartPayload = items.map(({ productId, sizeSku, qty }) => ({ productId, sizeSku, qty }));

  const requireForm = (form) => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  };

  const finish = (order) => {
    sessionStorage.setItem(
      "buzzora-last-order",
      JSON.stringify({ ...order, shippingAddress: customer })
    );
    clearCart();
    const vtParam = order?.verificationToken ? `&vt=${encodeURIComponent(order.verificationToken)}` : "";
    router.push(`/order-success?order=${encodeURIComponent(order.id)}${vtParam}`);
  };

  // --- WhatsApp / email / manual order ---------------------------------------
  const placeManualOrder = async (e) => {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!requireForm(form)) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          customer,
          items: cartPayload,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      const order = data.order;
      if (WHATSAPP) {
        const url = whatsAppUrl(WHATSAPP, orderToWhatsAppText(order, customer));
        window.open(url, "_blank", "noopener");
      }
      finish(order);
    } catch (err) {
      setError(err.message || "An unexpected error occurred while placing your order.");
      setSubmitting(false);
    }
  };

  // --- Online payment ---------------------------------------------------------
  const payOnline = async (e) => {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!requireForm(form)) return;

    setSubmitting(true);
    setError(null);

    try {
      let activeBuzzoraOrderId = existingBuzzoraOrderId;

      // 1. Create Buzzora Order in Supabase FIRST if not already created
      if (!activeBuzzoraOrderId) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            customer,
            items: cartPayload,
            idempotencyKey,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create order");
        }

        activeBuzzoraOrderId = data.order.id;
        setExistingBuzzoraOrderId(activeBuzzoraOrderId);
      }

      // 2. Initiate Payment
      if (PHONEPE) {
        // Pass ONLY the persistent buzzoraOrderId to PhonePe initiation
        await payWithPhonePe({ buzzoraOrderId: activeBuzzoraOrderId });
        // PhonePe iframe handles redirect to /api/phonepe/callback -> /order-success
      } else if (RAZORPAY) {
        const order = await payWithRazorpay({ items: cartPayload, customer });
        finish(order);
      }
    } catch (err) {
      setError(
        err.message || "Payment could not be completed. Your order is saved and you can try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-8 grid gap-8 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-6 lg:col-span-3">
        <GoogleSignIn
          user={googleUser}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleGoogleSignOut}
        />

        <div className="rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl">Shipping details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.name} className={f.span === 2 ? "sm:col-span-2" : ""}>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">
                  {f.label}
                </span>
                <input
                  required
                  type={f.type || "text"}
                  autoComplete={f.autoComplete}
                  value={customer[f.name] || ""}
                  onChange={(e) => setCustomer((c) => ({ ...c, [f.name]: e.target.value }))}
                  className="input"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="relative mt-4 overflow-hidden rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-3 -top-3 animate-floaty opacity-90">
            <BeeCharacter size={64} />
          </div>
          <h2 className="font-display text-2xl">Payment</h2>
          <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-charcoal-mute sm:max-w-none">
            {ONLINE_PAYMENT
              ? `Pay securely online with ${PHONEPE ? "UPI, cards or netbanking through PhonePe" : "cards, UPI or netbanking"}. Your payment is confirmed and verified on our side.`
              : WHATSAPP
                ? "Place your order and it opens in WhatsApp, pre-filled and ready to send to us. We'll confirm payment (UPI / bank transfer / cash on delivery) and delivery directly with you."
                : "Place your order and the Buzzora team will reach out on your phone or email to arrange payment and delivery."}
          </p>
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="sticky top-24 rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl">Order summary</h2>
          <ul className="mt-4 space-y-3 border-b border-charcoal/10 pb-4">
            {items.map((item) => (
              <li key={`${item.productId}-${item.sizeSku}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-honey-50 p-1">
                    {(item.size?.image || item.product.image) ? (
                      <img
                        src={item.size?.image || item.product.image}
                        alt={item.product.name}
                        className="h-10 w-auto max-h-10 object-contain drop-shadow-sm"
                      />
                    ) : (
                      <JarVisual tone={item.product.jarTone} label={item.product.honeyType} size={32} />
                    )}
                  </div>
                  <span>
                    {item.product.name} · {item.size.weight} × {item.qty}
                  </span>
                </div>
                <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-charcoal-mute">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-mute">Shipping</span>
              <span>{ONLINE_PAYMENT ? "Free" : "Confirmed with order"}</span>
            </div>
            <div className="flex justify-between border-t border-charcoal/10 pt-3 font-display text-xl">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {ONLINE_PAYMENT ? (
            <>
              <button onClick={payOnline} disabled={submitting} className="btn-accent mt-6 w-full disabled:opacity-60">
                {submitting
                  ? "Processing…"
                  : existingBuzzoraOrderId
                  ? `Retry Payment (${formatPrice(subtotal)})`
                  : `Pay ${formatPrice(subtotal)}`}
              </button>
              {WHATSAPP && (
                <button onClick={placeManualOrder} disabled={submitting} className="btn-ghost mt-2 w-full disabled:opacity-60">
                  Order via WhatsApp instead
                </button>
              )}
            </>
          ) : (
            <button onClick={placeManualOrder} disabled={submitting} className="btn-accent mt-6 w-full disabled:opacity-60">
              {submitting ? "Placing order…" : WHATSAPP ? "Order via WhatsApp" : "Place Order"}
            </button>
          )}

          <p className="mt-3 text-center text-xs text-charcoal-mute">
            🔒 Your details are used only to fulfil your order.
          </p>
        </div>
      </aside>
    </form>
  );
}
