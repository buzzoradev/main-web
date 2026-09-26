"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PaymentsTable({ initialData }) {
  const router = useRouter();

  const [payments, setPayments] = useState(initialData?.payments || []);
  const [pagination, setPagination] = useState(initialData?.pagination || { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 });

  // Filter states
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [reconciliationFilter, setReconciliationFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPayments = async (targetPage = 1, currentSearch = search, currentStatus = paymentStatus, currentRecon = reconciliationFilter) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pagination.pageSize || 25),
        search: currentSearch.trim(),
        paymentStatus: currentStatus,
        reconciliationFilter: currentRecon,
      });

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        throw new Error(`Failed to load payments (HTTP ${res.status})`);
      }

      const data = await res.json();
      setPayments(data.payments || []);
      setPagination(data.pagination || { page: targetPage, pageSize: 25, totalCount: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || "Failed to load payment records.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPayments(1, search, paymentStatus, reconciliationFilter);
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;
    setPaymentStatus(val);
    fetchPayments(1, search, val, reconciliationFilter);
  };

  const handleReconChange = (e) => {
    const val = e.target.value;
    setReconciliationFilter(val);
    fetchPayments(1, search, paymentStatus, val);
  };

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
      });
    } catch {
      return dateString;
    }
  };

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

  const getConsistencyBadge = (classification) => {
    switch (classification) {
      case "HEALTHY":
        return { text: "Healthy", class: "bg-emerald-950/60 text-emerald-300 border-emerald-800/80" };
      case "PAYMENT_PENDING":
        return { text: "Pending", class: "bg-amber-950/60 text-amber-300 border-amber-800/80" };
      case "PAYMENT_FAILED":
        return { text: "Failed Attempt", class: "bg-stone-900 text-stone-400 border-stone-800" };
      case "AMOUNT_MISMATCH":
        return { text: "Amount Mismatch", class: "bg-red-950 text-red-300 border-red-800 font-semibold" };
      case "CURRENCY_MISMATCH":
        return { text: "Currency Mismatch", class: "bg-red-950 text-red-300 border-red-800 font-semibold" };
      case "ORDER_PAYMENT_MISMATCH":
        return { text: "Order Mismatch", class: "bg-purple-950 text-purple-300 border-purple-800 font-semibold" };
      case "MULTIPLE_SUCCESS_PAYMENTS":
        return { text: "Multiple Success", class: "bg-rose-950 text-rose-300 border-rose-800 font-semibold" };
      case "PROVIDER_STATUS_MISMATCH":
        return { text: "Provider Mismatch", class: "bg-orange-950 text-orange-300 border-orange-800 font-semibold" };
      default:
        return { text: classification || "Check", class: "bg-stone-800 text-stone-300 border-stone-700" };
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 backdrop-blur-md">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <input
              id="payment-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Merchant TX ID, Provider TX, Order ID, customer email/phone..."
              className="w-full px-4 py-2 bg-stone-950/80 border border-stone-700/80 rounded-xl text-stone-100 placeholder-stone-500 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id="payment-status-filter"
              value={paymentStatus}
              onChange={handleStatusChange}
              className="px-3 py-2 bg-stone-950 border border-stone-700/80 rounded-xl text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">Payment: All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              id="recon-status-filter"
              value={reconciliationFilter}
              onChange={handleReconChange}
              className="px-3 py-2 bg-stone-950 border border-stone-700/80 rounded-xl text-stone-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">Reconciliation: All</option>
              <option value="HEALTHY">Healthy Only</option>
              <option value="ORDER_PAYMENT_MISMATCH">Order Mismatch</option>
              <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
              <option value="MULTIPLE_SUCCESS_PAYMENTS">Multiple Success</option>
              <option value="PROVIDER_STATUS_MISMATCH">Provider Mismatch</option>
              <option value="PAYMENT_PENDING">Pending Payments</option>
            </select>

            <button
              id="btn-apply-filters"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? "Filtering..." : "Search"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Table View */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/60 text-stone-400 uppercase tracking-wider text-[10px] border-b border-stone-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Payment / Merchant TX</th>
                <th className="py-3.5 px-4 font-semibold">Order</th>
                <th className="py-3.5 px-4 font-semibold">Customer</th>
                <th className="py-3.5 px-4 font-semibold">Amount</th>
                <th className="py-3.5 px-4 font-semibold">Payment Status</th>
                <th className="py-3.5 px-4 font-semibold">Consistency</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading payment records...</span>
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-400">
                    No payment attempts found matching criteria.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const reconBadge = getConsistencyBadge(p.consistency?.classification);
                  return (
                    <tr key={p.id} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-stone-200 font-semibold text-[11px] truncate max-w-[200px]" title={p.merchantTransactionId}>
                          {p.merchantTransactionId}
                        </div>
                        <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">
                          {p.paymentProvider} {p.providerTransactionId ? `• ${p.providerTransactionId.slice(0, 14)}...` : ""}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <Link
                          href={`/admin/orders/${p.buzzoraOrderId}`}
                          className="text-amber-400 hover:text-amber-300 font-medium hover:underline"
                        >
                          {p.buzzoraOrderId || "—"}
                        </Link>
                        <div className="text-[10px] text-stone-500 mt-0.5">
                          Order: <span className="uppercase text-stone-400">{p.order?.status || "—"}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-stone-200 font-medium truncate max-w-[140px]">
                          {p.order?.customerName || "—"}
                        </div>
                        <div className="text-[10px] text-stone-400 truncate max-w-[140px]">
                          {p.order?.customerEmail || p.order?.customerPhone || ""}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-stone-100">
                        {formatCurrency(p.amount, p.currency)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${getStatusBadge(p.paymentStatus)}`}>
                          {p.paymentStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border tracking-wider ${reconBadge.class}`}>
                          {reconBadge.text}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-stone-400 text-[11px]">
                        <div>{formatDate(p.createdAt)}</div>
                        {p.paidAt && (
                          <div className="text-[10px] text-emerald-400/80">Paid: {formatDate(p.paidAt)}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          id={`btn-inspect-payment-${p.id}`}
                          href={`/admin/payments/${p.id}`}
                          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-lg text-xs font-medium transition-all inline-block"
                        >
                          Reconcile →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="py-3 px-4 bg-stone-950/60 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div>
            Showing Page <span className="font-semibold text-stone-200">{pagination.page}</span> of{" "}
            <span className="font-semibold text-stone-200">{pagination.totalPages}</span> (
            <span className="font-semibold text-stone-200">{pagination.totalCount}</span> total attempts)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchPayments(pagination.page - 1)}
              className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800 text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchPayments(pagination.page + 1)}
              className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800 text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
