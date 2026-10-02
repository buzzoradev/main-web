"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/products";
import BeeCharacter from "@/components/BeeCharacter";

// Customer-safe payment status representation
function getPaymentStatusDisplay(paymentStatus) {
  const normalized = (paymentStatus || "PENDING").toUpperCase();
  switch (normalized) {
    case "SUCCESS":
      return {
        label: "Payment successful",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case "PENDING":
      return {
        label: "Payment confirmation pending",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
      };
    case "FAILED":
      return {
        label: "Payment failed",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        dotClass: "bg-rose-500",
      };
    case "CANCELLED":
      return {
        label: "Payment cancelled",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-200",
        dotClass: "bg-stone-400",
      };
    default:
      return {
        label: normalized,
        badgeClass: "bg-stone-100 text-stone-700 border-stone-200",
        dotClass: "bg-stone-400",
      };
  }
}

// Fulfillment status badge styling
function getFulfillmentStatusStyle(status) {
  const normalized = (status || "PENDING").toUpperCase();
  switch (normalized) {
    case "DELIVERED":
      return "bg-forest-pale text-forest border-forest/20";
    case "SHIPPED":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "PROCESSING":
      return "bg-honey-100 text-honey-900 border-honey-300";
    case "CONFIRMED":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "PENDING":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-stone-100 text-stone-700 border-stone-200";
  }
}

export default function TrackOrder() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams?.get("orderId") || searchParams?.get("order") || "";
  const initialVt = searchParams?.get("vt") || "";

  const [orderIdInput, setOrderIdInput] = useState(initialOrderId);
  const [emailOrPhoneInput, setEmailOrPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);

  // If customer arrives with an existing verified order link (?orderId=...&vt=...)
  useEffect(() => {
    if (!initialOrderId) return;

    let isMounted = true;

    if (initialVt) {
      setLoading(true);
      setError(null);

      fetch(`/api/orders/${encodeURIComponent(initialOrderId)}?vt=${encodeURIComponent(initialVt)}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("UNAUTHORIZED");
          }
          return res.json();
        })
        .then((data) => {
          if (isMounted && data?.order) {
            setOrderData(data.order);
            // Clean verification token from browser URL so it is not persisted in history or bookmarks
            if (typeof window !== "undefined" && window.history?.replaceState) {
              const cleanUrl = `/track-order?orderId=${encodeURIComponent(initialOrderId)}`;
              window.history.replaceState({}, "", cleanUrl);
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            // Token expired or invalid: prompt customer to verify contact details
            setError("To view order details, please verify your email or phone number.");
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setOrderIdInput(initialOrderId);
    }

    return () => {
      isMounted = false;
    };
  }, [initialOrderId, initialVt]);

  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    const cleanId = orderIdInput.trim();
    const cleanVerifier = emailOrPhoneInput.trim();

    if (!cleanId || !cleanVerifier) {
      setError("Please enter both your Buzzora Order ID and Email or Phone number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buzzoraOrderId: cleanId,
          emailOrPhone: cleanVerifier,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Strict anti-enumeration generic message from server
        throw new Error(
          data.error || "No order found matching the provided details. Please verify your information and try again."
        );
      }

      if (data?.order) {
        setOrderData(data.order);
      } else {
        throw new Error("We couldn't retrieve your order right now. Please try again.");
      }
    } catch (err) {
      setError(err.message || "We couldn't retrieve your order right now. Please try again.");
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSearch = () => {
    setOrderData(null);
    setError(null);
    setEmailOrPhoneInput("");
  };

  const paymentDisplay = orderData ? getPaymentStatusDisplay(orderData.paymentStatus) : null;
  const isCancelled = orderData?.status === "CANCELLED";
  const isPending = orderData?.status === "PENDING";
  const hasCourier = Boolean(
    orderData?.courier?.name || orderData?.courier?.trackingNumber || orderData?.courier?.trackingUrl
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header Mascot & Title */}
      <div className="text-center">
        <div className="mx-auto flex w-fit animate-wobble justify-center">
          <BeeCharacter size={80} />
        </div>
        <span className="sticker mt-3">📦 Order Tracking</span>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl text-charcoal">
          Track Your Buzzora Shipment
        </h1>
        <p className="mt-2 text-sm text-charcoal-mute max-w-md mx-auto">
          Enter your Buzzora Order ID and the Email or Phone number used during checkout to check live fulfillment progress.
        </p>
      </div>

      {/* Verification / Search Form (Visible when no order verified or when customer searches) */}
      {!orderData && (
        <form
          onSubmit={handleTrackSubmit}
          className="mt-8 rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8 shadow-soft"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="buzzora-order-id-input"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute"
              >
                Buzzora Order ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="buzzora-order-id-input"
                type="text"
                required
                placeholder="e.g. BZ-MUEW22D5-I9LY"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                className="input uppercase font-mono tracking-wider"
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="buzzora-verifier-input"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute"
              >
                Email Address or Phone <span className="text-rose-500">*</span>
              </label>
              <input
                id="buzzora-verifier-input"
                type="text"
                required
                placeholder="Email or 10-digit mobile"
                value={emailOrPhoneInput}
                onChange={(e) => setEmailOrPhoneInput(e.target.value)}
                className="input"
                autoComplete="email tel"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-2xl bg-rose-50/80 border border-rose-200 p-4 text-xs font-medium text-rose-800 flex items-start gap-2"
            >
              <span className="text-base leading-none">⚠️</span>
              <p className="flex-1 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full sm:w-auto px-8 disabled:opacity-60"
            >
              {loading ? "Verifying order…" : "Track Order"}
            </button>
            <p className="text-xs text-charcoal-mute flex items-center gap-1.5">
              <span>🔒</span> Private order verification ensures your personal data remains protected.
            </p>
          </div>
        </form>
      )}

      {/* Verified Order Results View */}
      {orderData && (
        <div className="mt-8 space-y-8 animate-fade-in">
          {/* Status Header Banner */}
          <div className="rounded-4xl border border-honey-200 bg-gradient-to-br from-honey-50 via-white to-cream p-6 sm:p-8 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">
                  Order Reference
                </span>
                <h2 className="font-display text-2xl sm:text-3xl text-charcoal tracking-wide">
                  {orderData.id}
                </h2>
                <p className="text-xs text-charcoal-mute mt-1">
                  Placed on{" "}
                  {new Date(orderData.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${getFulfillmentStatusStyle(
                    orderData.status
                  )}`}
                >
                  {orderData.status === "CONFIRMED"
                    ? "Order Confirmed"
                    : orderData.status === "PENDING"
                    ? "Order Pending"
                    : orderData.status}
                </span>

                {paymentDisplay && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${paymentDisplay.badgeClass}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${paymentDisplay.dotClass}`} />
                    {paymentDisplay.label}
                  </span>
                )}
              </div>
            </div>

            {/* Visual Fulfillment Progress Timeline */}
            {!isCancelled ? (
              <div className="mt-6 pt-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">
                    Fulfillment Progress
                  </p>
                  {isPending && (
                    <span className="text-xs text-amber-700 font-medium">
                      Awaiting payment gateway confirmation
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {orderData.timeline?.map((stage, i) => (
                    <div
                      key={stage.id}
                      className={`relative flex flex-col items-center text-center p-3.5 rounded-2xl border transition-all ${
                        stage.current
                          ? "border-honey-500 bg-honey-100/90 shadow-sm"
                          : stage.completed
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-charcoal/10 bg-white/60 opacity-60"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold mb-2 ${
                          stage.completed
                            ? "bg-emerald-600 text-white"
                            : stage.current
                            ? "bg-honey-500 text-charcoal font-black"
                            : "bg-charcoal/10 text-charcoal-mute"
                        }`}
                      >
                        {stage.completed ? "✓" : i + 1}
                      </div>
                      <p className="text-xs font-bold text-charcoal">{stage.label}</p>
                      <p className="mt-1 text-[11px] text-charcoal-mute leading-tight hidden sm:block">
                        {stage.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800">
                <strong>Order Cancelled:</strong> This order has been cancelled and will not progress through fulfillment. If you have questions regarding a refund or cancellation, please contact Buzzora support.
              </div>
            )}
          </div>

          {/* Courier & Shipment Section */}
          <div className="rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8 shadow-soft">
            <h3 className="font-display text-xl text-charcoal">Courier &amp; Delivery Tracking</h3>

            {hasCourier ? (
              <div className="mt-4 rounded-2xl bg-honey-50/70 border border-honey-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">
                    Courier Partner
                  </p>
                  <p className="text-base font-bold text-charcoal mt-0.5">
                    {orderData.courier.name || "Designated Courier Partner"}
                  </p>
                  {orderData.courier.trackingNumber && (
                    <p className="text-xs text-charcoal-mute mt-1">
                      Tracking Number:{" "}
                      <strong className="font-mono text-charcoal text-sm">
                        {orderData.courier.trackingNumber}
                      </strong>
                    </p>
                  )}
                  {orderData.courier.shippedAt && (
                    <p className="text-xs text-charcoal-mute mt-0.5">
                      Dispatched on {new Date(orderData.courier.shippedAt).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>

                {orderData.courier.trackingUrl ? (
                  <a
                    href={orderData.courier.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-2 text-center justify-center"
                  >
                    <span>Track Shipment</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                ) : (
                  <p className="text-xs text-charcoal-mute">
                    Tracking link will update once active with the courier.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-charcoal/10 bg-cream/40 p-5 text-sm text-charcoal-mute">
                ℹ️ Shipping information will appear here once your order is shipped.
              </div>
            )}
          </div>

          {/* Purchased Items & Delivery Address Grid */}
          <div className="grid gap-6 md:grid-cols-5">
            {/* Items Summary (3 cols) */}
            <div className="rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8 md:col-span-3 shadow-soft">
              <h3 className="font-display text-xl text-charcoal">Purchased Items</h3>
              <ul className="mt-4 divide-y divide-charcoal/10 border-b border-charcoal/10 pb-4 text-sm">
                {orderData.lines?.map((line, idx) => (
                  <li key={`${line.sku || line.name}-${idx}`} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-charcoal">{line.name}</p>
                      <p className="text-xs text-charcoal-mute mt-0.5">
                        {line.weight} × {line.qty} @ {formatPrice(line.unitPrice)}
                      </p>
                    </div>
                    <span className="font-semibold text-charcoal">
                      {formatPrice(line.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Financial Totals */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-charcoal-mute">
                  <span>Subtotal</span>
                  <span>{formatPrice(orderData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-charcoal-mute">
                  <span>Shipping</span>
                  <span>{orderData.shipping > 0 ? formatPrice(orderData.shipping) : "Free"}</span>
                </div>
                {orderData.couponDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Coupon ({orderData.couponCode})</span>
                    <span>-{formatPrice(orderData.couponDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-charcoal/10 pt-3 font-display text-xl text-charcoal">
                  <span>Total</span>
                  <span>{formatPrice(orderData.total)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address (2 cols) */}
            <div className="rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8 md:col-span-2 shadow-soft flex flex-col justify-between">
              <div>
                <h3 className="font-display text-xl text-charcoal">Shipping Address</h3>
                {orderData.shippingAddress && (
                  <div className="mt-4 text-sm text-charcoal-mute space-y-1">
                    <p className="font-semibold text-charcoal">{orderData.customer?.name}</p>
                    <p className="mt-1">{orderData.shippingAddress.address}</p>
                    <p>
                      {orderData.shippingAddress.city}, {orderData.shippingAddress.state}{" "}
                      {orderData.shippingAddress.postcode}
                    </p>
                    <p>{orderData.shippingAddress.country}</p>
                    <div className="pt-3 border-t border-charcoal/10 mt-3 text-xs space-y-1">
                      <p>
                        <strong className="text-charcoal">Email:</strong> {orderData.customer?.email}
                      </p>
                      <p>
                        <strong className="text-charcoal">Phone:</strong> {orderData.customer?.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="btn-ghost w-full text-center text-xs py-2"
                >
                  🔍 Track Another Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return to Home Link */}
      <div className="mt-12 text-center">
        <Link href="/" className="btn-ghost">
          ← Return to Buzzora Homepage
        </Link>
      </div>
    </div>
  );
}
