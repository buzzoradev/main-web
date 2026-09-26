"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FulfillmentActionsCard({ order }) {
  const router = useRouter();
  const currentStatus = (order.status || "PENDING").toUpperCase();

  // Form states
  const [courierName, setCourierName] = useState(order.fulfillment?.courierName || "");
  const [trackingNumber, setTrackingNumber] = useState(order.fulfillment?.trackingNumber || "");
  const [trackingUrl, setTrackingUrl] = useState(order.fulfillment?.trackingUrl || "");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isConflict, setIsConflict] = useState(false);

  const handleTransition = async (targetStatus, shippingData = null, reasonText = null) => {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setIsConflict(false);

    try {
      const payload = { targetStatus };
      if (shippingData) payload.shippingDetails = shippingData;
      if (reasonText) payload.reason = reasonText;

      const res = await fetch(`/api/admin/orders/${order.buzzoraOrderId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409) {
        setIsConflict(true);
        setErrorMessage(
          data?.error || "Concurrency Conflict: This order was modified by another administrator. Please refresh."
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorMessage(data?.error || `Failed to transition order to '${targetStatus}'.`);
        setLoading(false);
        return;
      }

      setSuccessMessage(
        data?.isIdempotent
          ? `Order is already in '${targetStatus}' status (idempotent repeat).`
          : `Order successfully transitioned to '${targetStatus}'!`
      );
      setShowCancelModal(false);
      router.refresh();
    } catch {
      setErrorMessage("Network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleShipSubmit = (e) => {
    e.preventDefault();
    if (!courierName.trim() || !trackingNumber.trim()) {
      setErrorMessage("Please enter both courier name and tracking number to ship the order.");
      return;
    }
    handleTransition("SHIPPED", {
      courierName: courierName.trim(),
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim() || null,
    });
  };

  const handleCancelSubmit = (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setErrorMessage("Please provide a reason for cancelling this order.");
      return;
    }
    handleTransition("CANCELLED", null, cancelReason.trim());
  };

  return (
    <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-stone-800">
        <div>
          <h2 className="text-base font-serif font-semibold text-stone-100">
            Fulfillment Actions
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Stage 6C State Machine & Immutable Timestamps
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">Current Status:</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {currentStatus}
          </span>
        </div>
      </div>

      {/* Conflict / Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2">
            <span className="text-red-400 font-bold">!</span>
            <span>{errorMessage}</span>
          </div>
          {isConflict && (
            <button
              onClick={() => router.refresh()}
              className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded-lg text-xs font-medium cursor-pointer"
            >
              Refresh Order
            </button>
          )}
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div
          role="alert"
          className="mt-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2"
        >
          <span className="text-emerald-400 font-bold">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Contextual Action Workflows based on Current Status */}
      <div className="mt-5">
        {currentStatus === "CONFIRMED" && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-stone-950/60 border border-stone-800">
            <div>
              <div className="text-xs font-medium text-stone-200">Ready for Packaging</div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                Payment has been confirmed. Move order to processing to begin packing honey jars.
              </div>
            </div>
            <button
              id="action-mark-processing"
              type="button"
              disabled={loading}
              onClick={() => handleTransition("PROCESSING")}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Advance to Processing"}
            </button>
          </div>
        )}

        {currentStatus === "PROCESSING" && (
          <form onSubmit={handleShipSubmit} className="space-y-4 p-4 rounded-xl bg-stone-950/60 border border-stone-800">
            <div>
              <div className="text-xs font-semibold text-stone-200 uppercase tracking-wider">
                Dispatch & Shipping Details
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                Enter courier and tracking details before marking the order as shipped.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="ship-courier" className="block text-[11px] uppercase font-medium text-stone-300 mb-1">
                  Courier Name <span className="text-amber-400">*</span>
                </label>
                <input
                  id="ship-courier"
                  type="text"
                  required
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="e.g. Delhivery, BlueDart"
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="ship-tracking" className="block text-[11px] uppercase font-medium text-stone-300 mb-1">
                  Tracking Number <span className="text-amber-400">*</span>
                </label>
                <input
                  id="ship-tracking"
                  type="text"
                  required
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. DEL12345678"
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label htmlFor="ship-url" className="block text-[11px] uppercase font-medium text-stone-300 mb-1">
                  Tracking URL <span className="text-stone-500">(Optional)</span>
                </label>
                <input
                  id="ship-url"
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://track.courier.com/..."
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                id="action-mark-shipped"
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? "Dispatching..." : "Confirm Shipment & Set Shipped"}
              </button>
            </div>
          </form>
        )}

        {currentStatus === "SHIPPED" && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-stone-950/60 border border-stone-800">
            <div>
              <div className="text-xs font-medium text-stone-200">Out for Delivery with Courier</div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                Courier: <span className="text-stone-300 font-medium">{order.fulfillment?.courierName || "N/A"}</span> | Tracking: <span className="text-stone-300 font-mono">{order.fulfillment?.trackingNumber || "N/A"}</span>
              </div>
            </div>
            <button
              id="action-mark-delivered"
              type="button"
              disabled={loading}
              onClick={() => handleTransition("DELIVERED")}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "Completing..." : "Mark as Delivered"}
            </button>
          </div>
        )}

        {currentStatus === "PENDING" && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/40 text-amber-200/90 text-xs">
            <span className="font-semibold">Awaiting Customer Payment:</span> Order status cannot advance until payment is verified by the PhonePe webhook or callback.
          </div>
        )}

        {currentStatus === "DELIVERED" && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <span>✓</span> Order successfully fulfilled and delivered. Terminal state.
          </div>
        )}

        {currentStatus === "CANCELLED" && (
          <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 text-xs font-medium">
            Order has been cancelled. Terminal state.
          </div>
        )}

        {/* Pre-Dispatch Cancellation Button */}
        {["PENDING", "CONFIRMED", "PROCESSING"].includes(currentStatus) && (
          <div className="mt-4 pt-4 border-t border-stone-800/60 flex justify-end">
            {!showCancelModal ? (
              <button
                id="btn-open-cancel"
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="text-xs text-red-400 hover:text-red-300 underline font-medium"
              >
                Cancel Order
              </button>
            ) : (
              <form onSubmit={handleCancelSubmit} className="w-full p-4 rounded-xl bg-red-950/30 border border-red-900/50 space-y-3">
                <div className="text-xs font-semibold text-red-200">
                  Confirm Pre-Dispatch Cancellation
                </div>
                <input
                  id="cancel-reason-input"
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (required for audit log)..."
                  className="w-full px-3 py-2 bg-stone-950 border border-red-900/80 rounded-lg text-stone-100 text-xs focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="px-3 py-1.5 bg-stone-800 text-stone-300 text-xs rounded-lg"
                  >
                    Dismiss
                  </button>
                  <button
                    id="btn-confirm-cancel"
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
