import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPaymentDetails } from "@/lib/admin/payments";
import AdminHeader from "@/components/admin/AdminHeader";
import ReconcilePaymentAction from "@/components/admin/ReconcilePaymentAction";

export const dynamic = "force-dynamic";

export default async function AdminPaymentDetailPage({ params }) {
  let adminContext;
  try {
    adminContext = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const paymentId = params?.id;
  let paymentDetails = null;

  try {
    const res = await getAdminPaymentDetails(paymentId, adminContext);
    paymentDetails = res.payment;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 400) {
      notFound();
    }
    console.error("[AdminPaymentDetailPage] Error:", err.message);
  }

  if (!paymentDetails) {
    notFound();
  }

  const formatCurrency = (amt, curr = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 2,
    }).format(amt || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const p = paymentDetails;
  const o = paymentDetails.order;
  const consistency = paymentDetails.consistency || {};

  const getStatusBadge = (status) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case "SUCCESS":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "FAILED":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "CANCELLED":
        return "bg-stone-500/10 text-stone-400 border-stone-500/20";
      case "PENDING":
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      <AdminHeader adminContext={adminContext} currentSection="payments" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <Link href="/admin/payments" className="hover:text-amber-400 transition-colors">
            Payments
          </Link>
          <span>/</span>
          <span className="font-mono text-stone-200">{p.merchantTransactionId}</span>
        </div>

        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-bold text-stone-100">
                Payment Attempt Details
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getStatusBadge(p.paymentStatus)}`}>
                {p.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-stone-400 font-mono mt-1">
              ID: {p.id}
            </p>
          </div>

          <Link
            href={o?.buzzoraOrderId ? `/admin/orders/${o.buzzoraOrderId}` : "/admin/orders"}
            className="px-4 py-2 bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-200 text-xs font-medium rounded-xl transition-all"
          >
            View Parent Order ({o?.buzzoraOrderId || "—"}) →
          </Link>
        </div>

        {/* Reconcile Action Card */}
        <ReconcilePaymentAction payment={p} />

        {/* Consistency & Health Card */}
        <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-200">
              Consistency & Order Alignment
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider bg-stone-950 border border-stone-700 text-stone-300">
              {consistency.classification || "UNKNOWN"}
            </span>
          </div>

          {consistency.issues && consistency.issues.length > 0 ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 space-y-2">
              <div className="text-xs font-semibold text-red-200 flex items-center gap-1.5">
                <span>⚠️</span> Inconsistencies Detected:
              </div>
              <ul className="list-disc list-inside text-xs text-red-300/90 space-y-1">
                {consistency.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-xs text-emerald-200 flex items-center gap-2">
              <span>✓</span> Payment record and parent order are aligned and consistent with store financial records.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
            <div>
              <span className="text-stone-400 block text-[11px]">Payment Amount</span>
              <span className="font-semibold text-stone-100">{formatCurrency(p.amount, p.currency)}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[11px]">Authoritative Order Total</span>
              <span className="font-semibold text-stone-100">{formatCurrency(o?.total, o?.currency)}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[11px]">Amount Match</span>
              <span className={consistency.details?.amountMatches ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                {consistency.details?.amountMatches ? "Exact Match (✓)" : "Mismatch (✗)"}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block text-[11px]">Currency Match</span>
              <span className={consistency.details?.currencyMatches ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                {consistency.details?.currencyMatches ? `${p.currency} (✓)` : "Mismatch (✗)"}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Payment Attempt vs Parent Order */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Attempt Card */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-200 pb-3 border-b border-stone-800">
              Transaction Details
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <dt className="text-stone-400 text-[11px]">Merchant Transaction ID</dt>
                <dd className="font-mono text-stone-200 mt-0.5 break-all">{p.merchantTransactionId}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Payment Gateway Provider</dt>
                <dd className="uppercase font-semibold text-stone-200 mt-0.5">{p.paymentProvider}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Provider Reference ID</dt>
                <dd className="font-mono text-stone-200 mt-0.5 break-all">{p.providerTransactionId || "—"}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Payment Status</dt>
                <dd className="mt-0.5 font-semibold text-stone-100">{p.paymentStatus}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Created At</dt>
                <dd className="text-stone-300 mt-0.5">{formatDate(p.createdAt)}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Paid Timestamp</dt>
                <dd className="text-stone-300 mt-0.5">{formatDate(p.paidAt)}</dd>
              </div>
            </dl>

            {p.providerResponse && (
              <div className="pt-3 border-t border-stone-800">
                <span className="text-[11px] text-stone-400 block mb-1">Sanitized Provider Response</span>
                <pre className="p-3 bg-stone-950 rounded-xl text-[11px] font-mono text-stone-300 overflow-x-auto">
                  {JSON.stringify(p.providerResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Parent Order Card */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-200 pb-3 border-b border-stone-800">
              Parent Order Snapshot
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <dt className="text-stone-400 text-[11px]">Buzzora Order ID</dt>
                <dd className="font-mono text-amber-400 font-semibold mt-0.5">{o?.buzzoraOrderId}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Order Status</dt>
                <dd className="uppercase font-semibold text-stone-200 mt-0.5">{o?.status}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Customer Name</dt>
                <dd className="text-stone-200 mt-0.5 font-medium">{o?.customerName}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Customer Email</dt>
                <dd className="text-stone-200 mt-0.5 break-all">{o?.customerEmail}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Customer Phone</dt>
                <dd className="text-stone-200 mt-0.5">{o?.customerPhone}</dd>
              </div>

              <div>
                <dt className="text-stone-400 text-[11px]">Order Total</dt>
                <dd className="text-stone-100 font-semibold mt-0.5">{formatCurrency(o?.total, o?.currency)}</dd>
              </div>
            </dl>

            {/* Line items snippet */}
            {p.orderItems && p.orderItems.length > 0 && (
              <div className="pt-3 border-t border-stone-800">
                <span className="text-[11px] text-stone-400 block mb-2">Order Line Items ({p.orderItems.length})</span>
                <div className="space-y-1.5">
                  {p.orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-stone-950/60">
                      <span className="text-stone-300 truncate max-w-[200px]">{item.productName} (x{item.quantity})</span>
                      <span className="font-semibold text-stone-200 font-mono">{formatCurrency(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sibling Payment Attempts (Multi-Attempt History) */}
        {p.siblingAttempts && p.siblingAttempts.length > 1 && (
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-200">
                All Payment Attempts for This Order ({p.siblingAttempts.length})
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Customers may make multiple checkout attempts if initial attempts expire or fail.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950/60 text-stone-400 uppercase text-[10px] border-b border-stone-800">
                  <tr>
                    <th className="py-2.5 px-3">Merchant TX ID</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/40">
                  {p.siblingAttempts.map((attempt) => (
                    <tr
                      key={attempt.id}
                      className={attempt.id === p.id ? "bg-amber-500/5 font-medium" : "hover:bg-stone-800/20"}
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {attempt.merchantTransactionId}
                        {attempt.id === p.id && <span className="ml-2 text-amber-400 font-bold">(Current)</span>}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-stone-100">
                        {formatCurrency(attempt.amount, attempt.currency)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(attempt.paymentStatus)}`}>
                          {attempt.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-stone-400 text-[11px]">{formatDate(attempt.createdAt)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {attempt.id !== p.id && (
                          <Link
                            href={`/admin/payments/${attempt.id}`}
                            className="text-amber-400 hover:text-amber-300 hover:underline text-xs"
                          >
                            Inspect →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reconciliation Audit Trail */}
        {p.reconciliationAudit && p.reconciliationAudit.length > 0 && (
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-200 pb-3 border-b border-stone-800">
              Reconciliation Audit Trail
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950/60 text-stone-400 uppercase text-[10px] border-b border-stone-800">
                  <tr>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Status Transition</th>
                    <th className="py-2.5 px-3">Order Updated</th>
                    <th className="py-2.5 px-3">Audited By</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/40">
                  {p.reconciliationAudit.map((audit) => (
                    <tr key={audit.id}>
                      <td className="py-2.5 px-3 font-semibold text-stone-200">{audit.action}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{audit.reconciliationResult}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-stone-400">{audit.previousPaymentStatus || "—"}</span>
                        {" → "}
                        <span className="text-stone-100 font-semibold">{audit.resultingPaymentStatus || "—"}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {audit.orderStatusUpdated ? (
                          <span className="text-emerald-400 font-semibold">Yes (→ CONFIRMED)</span>
                        ) : (
                          <span className="text-stone-500">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-stone-400">{audit.adminEmail || "Admin"}</td>
                      <td className="py-2.5 px-3 text-stone-400 text-[11px]">{formatDate(audit.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
