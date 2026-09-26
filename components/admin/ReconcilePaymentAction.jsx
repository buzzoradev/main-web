"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReconcilePaymentAction({ payment }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleReconcile = async () => {
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Reconciliation failed (HTTP ${res.status})`);
      }

      setSuccessMsg(data?.message || "Payment state verified and synchronized with PhonePe.");
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message || "Failed to reconcile with PhonePe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-serif font-semibold text-stone-100">
            Payment Reconciliation Engine
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Queries the PhonePe Standard Checkout server gateway directly. Server-authoritative amount & identifier verification.
          </p>
        </div>

        <button
          id="btn-reconcile-payment"
          type="button"
          disabled={loading}
          onClick={handleReconcile}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
              <span>Checking PhonePe…</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Reconcile with PhonePe</span>
            </>
          )}
        </button>
      </div>

      {/* Security notice regarding no manual overrides */}
      <div className="text-[11px] text-stone-500 border-t border-stone-800/80 pt-3 flex items-center gap-2">
        <span className="text-amber-500/80 font-bold">ℹ</span>
        <span>
          Buzzora maintains strict server-authoritative payment integrity. Manual status overrides (&ldquo;Mark as Paid&rdquo;) are strictly prohibited. Payment status updates only when verified directly against PhonePe.
        </span>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div role="alert" className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error / Mismatch banner */}
      {errorMsg && (
        <div role="alert" className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2">
          <span className="text-red-400 font-bold">!</span>
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
