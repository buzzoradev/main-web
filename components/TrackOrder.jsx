"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/products";
import BeeCharacter from "@/components/BeeCharacter";

export default function TrackOrder() {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [emailOrPhoneInput, setEmailOrPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);

  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    if (!orderIdInput.trim() || !emailOrPhoneInput.trim()) {
      setError("Please enter both your Buzzora Order ID and Email/Phone number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buzzoraOrderId: orderIdInput.trim(),
          emailOrPhone: emailOrPhoneInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not track order.");
      }

      setOrderData(data.order);
    } catch (err) {
      setError(err.message);
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "DELIVERED":
        return "bg-forest-pale text-forest border-forest/20";
      case "SHIPPED":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "PROCESSING":
        return "bg-honey-100 text-honey-900 border-honey-300";
      case "CONFIRMED":
        return "bg-amber-50 text-amber-900 border-amber-200";
      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex w-fit animate-wobble justify-center">
          <BeeCharacter size={80} />
        </div>
        <span className="sticker mt-3">📦 Order Tracking</span>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">Track Your Buzzora Shipment</h1>
        <p className="mt-2 text-sm text-charcoal-mute">
          Enter your Order ID and the Email or Phone number used during checkout to view live status.
        </p>
      </div>

      {/* Lookup Form */}
      <form
        onSubmit={handleTrackSubmit}
        className="mt-8 rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8 shadow-soft"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">
              Buzzora Order ID *
            </span>
            <input
              required
              type="text"
              placeholder="e.g. BZ-LVT26K1L-X9A1"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              className="input uppercase"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">
              Email Address or Phone *
            </span>
            <input
              required
              type="text"
              placeholder="Email or mobile number"
              value={emailOrPhoneInput}
              onChange={(e) => setEmailOrPhoneInput(e.target.value)}
              className="input"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 font-medium">
            ⚠️ {error}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-accent w-full sm:w-auto px-8 disabled:opacity-60"
          >
            {loading ? "Searching…" : "Track Order"}
          </button>
          <p className="text-xs text-charcoal-mute">
            🔒 Private order lookup verification.
          </p>
        </div>
      </form>

      {/* Order Results View */}
      {orderData && (
        <div className="mt-10 space-y-8 animate-fade-in">
          {/* Status Header Banner */}
          <div className="rounded-4xl border border-honey-200 bg-gradient-to-br from-honey-50 via-white to-cream p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">
                  Order Reference
                </span>
                <h2 className="font-display text-2xl text-charcoal">{orderData.id}</h2>
                <p className="text-xs text-charcoal-mute mt-0.5">
                  Placed on {new Date(orderData.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <span
                  className={`inline-block rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${getStatusBadgeStyle(
                    orderData.status
                  )}`}
                >
                  {orderData.status === "CONFIRMED" ? "Order Confirmed" : orderData.status}
                </span>
              </div>
            </div>

            {/* Status Timeline */}
            {orderData.status !== "CANCELLED" ? (
              <div className="mt-6 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute mb-4">
                  Order Progress Timeline
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {orderData.timeline.map((stage, i) => (
                    <div
                      key={stage.id}
                      className={`relative flex flex-col items-center text-center p-3 rounded-2xl border transition ${
                        stage.current
                          ? "border-honey-400 bg-honey-100/70 shadow-sm"
                          : stage.completed
                          ? "border-forest-pale/60 bg-forest-pale/20"
                          : "border-charcoal/5 bg-white/40 opacity-60"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold mb-2 ${
                          stage.completed
                            ? "bg-forest text-cream"
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
              <div className="mt-5 rounded-2xl bg-red-50 p-4 text-xs text-red-700">
                This order was cancelled. If you have questions, please reach out to customer support.
              </div>
            )}
          </div>

          {/* Courier & Tracking Details */}
          <div className="rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8">
            <h3 className="font-display text-xl">Courier &amp; Delivery Tracking</h3>

            {orderData.courier?.trackingUrl || orderData.courier?.trackingNumber ? (
              <div className="mt-4 rounded-2xl bg-honey-50/70 border border-honey-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">
                    Courier Partner
                  </p>
                  <p className="text-base font-bold text-charcoal">
                    {orderData.courier.name || "Standard Courier Partner"}
                  </p>
                  {orderData.courier.trackingNumber && (
                    <p className="text-xs text-charcoal-mute mt-1">
                      Tracking AW/No: <strong className="text-charcoal">{orderData.courier.trackingNumber}</strong>
                    </p>
                  )}
                </div>

                {orderData.courier.trackingUrl ? (
                  <a
                    href={orderData.courier.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent inline-flex items-center gap-2 text-center justify-center"
                  >
                    <span>Track Shipment</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <p className="text-xs text-charcoal-mute">Tracking link will be updated shortly.</p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-charcoal/10 bg-cream/40 p-4 text-sm text-charcoal-mute">
                ℹ️ Tracking information will be available once your order has been shipped.
              </div>
            )}
          </div>

          {/* Items & Shipping Address Grid */}
          <div className="grid gap-6 md:grid-cols-5">
            <div className="rounded-4xl border border-charcoal/10 bg-white p-6 md:col-span-3">
              <h3 className="font-display text-xl">Order Items</h3>
              <ul className="mt-4 divide-y divide-charcoal/10 border-b border-charcoal/10 pb-4 text-sm">
                {orderData.lines?.map((line, idx) => (
                  <li key={`${line.sku}-${idx}`} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-charcoal">{line.name}</p>
                      <p className="text-xs text-charcoal-mute">
                        {line.weight} × {line.qty}
                      </p>
                    </div>
                    <span className="font-semibold text-charcoal">{formatPrice(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-charcoal-mute">
                  <span>Subtotal</span>
                  <span>{formatPrice(orderData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-charcoal-mute">
                  <span>Shipping</span>
                  <span>{orderData.shipping > 0 ? formatPrice(orderData.shipping) : "Free"}</span>
                </div>
                <div className="flex justify-between border-t border-charcoal/10 pt-3 font-display text-lg text-charcoal">
                  <span>Total</span>
                  <span>{formatPrice(orderData.total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-4xl border border-charcoal/10 bg-white p-6 md:col-span-2">
              <h3 className="font-display text-xl">Shipping Details</h3>
              {orderData.shippingAddress && (
                <div className="mt-4 text-sm text-charcoal-mute space-y-1">
                  <p className="font-semibold text-charcoal">{orderData.customer?.name}</p>
                  <p>{orderData.shippingAddress.address}</p>
                  <p>
                    {orderData.shippingAddress.city}, {orderData.shippingAddress.state}{" "}
                    {orderData.shippingAddress.postcode}
                  </p>
                  <p>{orderData.shippingAddress.country}</p>
                  <p className="pt-2 text-xs">
                    <strong>Phone:</strong> {orderData.customer?.phone}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back to Home Link */}
      <div className="mt-12 text-center">
        <Link href="/" className="btn-ghost">
          ← Return to Buzzora Homepage
        </Link>
      </div>
    </div>
  );
}
