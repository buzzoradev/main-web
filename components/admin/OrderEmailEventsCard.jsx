"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatTimestamp(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function OrderEmailEventsCard({ order }) {
  const router = useRouter();
  const buzzoraOrderId = order.buzzoraOrderId;
  const emailEvents = order.emailEvents || [];

  const [loadingEvent, setLoadingEvent] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const confirmationEvent = emailEvents.find((e) => e.eventType === "ORDER_CONFIRMED");
  const shippingEvent = emailEvents.find((e) => e.eventType === "ORDER_SHIPPED");

  const isConfirmedOrBeyond = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status);
  const isShippedOrBeyond = ["SHIPPED", "DELIVERED"].includes(order.status);

  const handleRetry = async (eventType) => {
    setLoadingEvent(eventType);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(buzzoraOrderId)}/email-retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Failed to retry email." });
      } else {
        setFeedback({
          type: "success",
          message: data.isIdempotent
            ? "Email was already marked as SENT (idempotent)."
            : "Email retry triggered successfully!",
        });
        router.refresh();
      }
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Network error while retrying email." });
    } finally {
      setLoadingEvent(null);
    }
  };

  const renderBadge = (status) => {
    switch (status) {
      case "SENT":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300">
            ✓ SENT
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-950/80 border border-red-800 text-red-300">
            ✗ FAILED
          </span>
        );
      case "PENDING":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-950/80 border border-amber-800 text-amber-300">
            ⏳ PENDING
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-stone-800 text-stone-400">
            NOT TRIGGERED
          </span>
        );
    }
  };

  return (
    <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-stone-800">
        <div>
          <h2 className="text-base font-serif font-semibold text-stone-100 flex items-center gap-2">
            <span>✉️</span> Transactional Email Status
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Powered by Resend with Server-Side Idempotency
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 p-3 rounded-xl text-xs font-medium ${
            feedback.type === "error"
              ? "bg-red-950/60 border border-red-800 text-red-300"
              : "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* 1. Order Confirmation Email */}
        <div className="p-4 rounded-xl bg-stone-950/50 border border-stone-800/80">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-200">Order Confirmation Email</span>
            {renderBadge(confirmationEvent?.status)}
          </div>
          <div className="mt-2 text-xs text-stone-400 space-y-1">
            <div className="flex justify-between">
              <span>Recipient:</span>
              <span className="text-stone-300 font-mono">{order.customer?.email || "-"}</span>
            </div>
            {confirmationEvent?.sentAt && (
              <div className="flex justify-between">
                <span>Sent At:</span>
                <span className="text-stone-300">{formatTimestamp(confirmationEvent.sentAt)}</span>
              </div>
            )}
            {confirmationEvent?.resendEmailId && (
              <div className="flex justify-between">
                <span>Resend ID:</span>
                <span className="text-amber-400 font-mono text-[11px]">{confirmationEvent.resendEmailId}</span>
              </div>
            )}
            {confirmationEvent?.lastError && (
              <div className="mt-2 p-2 rounded bg-red-950/40 border border-red-900/60 text-red-300 text-[11px]">
                Error: {confirmationEvent.lastError}
              </div>
            )}
          </div>
          {isConfirmedOrBeyond && confirmationEvent?.status !== "SENT" && (
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => handleRetry("ORDER_CONFIRMED")}
                disabled={loadingEvent === "ORDER_CONFIRMED"}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 disabled:opacity-50 transition-colors"
              >
                {loadingEvent === "ORDER_CONFIRMED" ? "Sending..." : "Retry Confirmation Email"}
              </button>
            </div>
          )}
        </div>

        {/* 2. Order Shipped Email */}
        <div className="p-4 rounded-xl bg-stone-950/50 border border-stone-800/80">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-200">Shipping Notification Email</span>
            {renderBadge(shippingEvent?.status)}
          </div>
          <div className="mt-2 text-xs text-stone-400 space-y-1">
            <div className="flex justify-between">
              <span>Recipient:</span>
              <span className="text-stone-300 font-mono">{order.customer?.email || "-"}</span>
            </div>
            {shippingEvent?.sentAt && (
              <div className="flex justify-between">
                <span>Sent At:</span>
                <span className="text-stone-300">{formatTimestamp(shippingEvent.sentAt)}</span>
              </div>
            )}
            {shippingEvent?.resendEmailId && (
              <div className="flex justify-between">
                <span>Resend ID:</span>
                <span className="text-amber-400 font-mono text-[11px]">{shippingEvent.resendEmailId}</span>
              </div>
            )}
            {shippingEvent?.lastError && (
              <div className="mt-2 p-2 rounded bg-red-950/40 border border-red-900/60 text-red-300 text-[11px]">
                Error: {shippingEvent.lastError}
              </div>
            )}
          </div>
          {isShippedOrBeyond && shippingEvent?.status !== "SENT" && (
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => handleRetry("ORDER_SHIPPED")}
                disabled={loadingEvent === "ORDER_SHIPPED"}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 disabled:opacity-50 transition-colors"
              >
                {loadingEvent === "ORDER_SHIPPED" ? "Sending..." : "Retry Shipping Email"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
