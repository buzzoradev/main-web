"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount || 0);
}

function formatDate(isoString) {
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

function getOrderStatusBadge(status) {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "PENDING":
      return "bg-amber-950/60 text-amber-300 border-amber-800/80";
    case "CONFIRMED":
      return "bg-sky-950/60 text-sky-300 border-sky-800/80";
    case "PROCESSING":
      return "bg-purple-950/60 text-purple-300 border-purple-800/80";
    case "SHIPPED":
      return "bg-blue-950/60 text-blue-300 border-blue-800/80";
    case "DELIVERED":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/80";
    case "CANCELLED":
      return "bg-stone-800 text-stone-400 border-stone-700";
    default:
      return "bg-stone-800 text-stone-300 border-stone-700";
  }
}

function getPaymentBadge(status) {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "SUCCESS":
      return "bg-emerald-950/60 text-emerald-400 border-emerald-800/80";
    case "PENDING":
      return "bg-amber-950/60 text-amber-300 border-amber-800/80";
    case "FAILED":
      return "bg-red-950/60 text-red-400 border-red-800/80";
    default:
      return "bg-stone-800 text-stone-400 border-stone-700";
  }
}

export default function OrdersTable({ initialData = {} }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven query state
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [orderStatus, setOrderStatus] = useState(searchParams.get("orderStatus") || "ALL");
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("paymentStatus") || "ALL");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get("pageSize") || "20", 10));

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(initialData);

  // Synchronize state with URL and trigger server-side fetch
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (page > 1) params.set("page", page.toString());
      if (pageSize !== 20) params.set("pageSize", pageSize.toString());
      if (search.trim()) params.set("search", search.trim());
      if (orderStatus && orderStatus !== "ALL") params.set("orderStatus", orderStatus);
      if (paymentStatus && paymentStatus !== "ALL") params.set("paymentStatus", paymentStatus);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("[OrdersTable] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, orderStatus, paymentStatus]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  // Handle Filter Change
  const handleOrderStatusChange = (newStatus) => {
    setOrderStatus(newStatus);
    setPage(1);
  };

  const handlePaymentStatusChange = (newPayment) => {
    setPaymentStatus(newPayment);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setOrderStatus("ALL");
    setPaymentStatus("ALL");
    setPage(1);
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const orders = data?.orders || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search, Filters & PageSize */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <input
                id="orders-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Order ID, Name, Email, or Phone..."
                className="w-full pl-10 pr-4 py-2 bg-stone-950/80 border border-stone-700/80 rounded-xl text-stone-100 placeholder-stone-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
              <svg
                className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              id="orders-search-btn"
              type="submit"
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs sm:text-sm font-medium rounded-xl border border-stone-700 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Order Status Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-order-status" className="text-xs text-stone-400 font-medium whitespace-nowrap">
                Order:
              </label>
              <select
                id="filter-order-status"
                value={orderStatus}
                onChange={(e) => handleOrderStatusChange(e.target.value)}
                className="bg-stone-950 border border-stone-700/80 text-stone-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="filter-payment-status" className="text-xs text-stone-400 font-medium whitespace-nowrap">
                Payment:
              </label>
              <select
                id="filter-payment-status"
                value={paymentStatus}
                onChange={(e) => handlePaymentStatusChange(e.target.value)}
                className="bg-stone-950 border border-stone-700/80 text-stone-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="ALL">All Payments</option>
                <option value="SUCCESS">Success</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {(search || orderStatus !== "ALL" || paymentStatus !== "ALL") && (
              <button
                id="orders-reset-filters-btn"
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-medium px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-900 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Order ID</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Date</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Customer</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Amount</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Payment</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Order Status</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Courier & Tracking</th>
                <th scope="col" className="px-5 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-stone-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-stone-400">
                    <p className="text-sm font-medium text-stone-300">No orders found.</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Try adjusting your search criteria or resetting filters.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-4 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 rounded-xl border border-stone-700 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.buzzoraOrderId} className="hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-stone-100 whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${o.buzzoraOrderId}`}
                        className="text-amber-400 hover:text-amber-300 hover:underline"
                      >
                        {o.buzzoraOrderId}
                      </Link>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-stone-400">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-stone-200">{o.customer?.name}</div>
                      <div className="text-[11px] text-stone-400">{o.customer?.email}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-stone-100 whitespace-nowrap">
                      {formatCurrency(o.amount)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPaymentBadge(o.paymentStatus)}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getOrderStatusBadge(o.orderStatus)}`}>
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-stone-400">
                      {o.fulfillment?.courierName ? (
                        <div>
                          <div className="text-stone-200 font-medium">{o.fulfillment.courierName}</div>
                          <div className="text-[11px] font-mono text-stone-400">
                            {o.fulfillment.trackingNumber || "-"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-stone-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${o.buzzoraOrderId}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-700 text-xs font-medium transition-colors"
                      >
                        View Order
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-stone-900/90 border-t border-stone-800 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-400">
            Showing <span className="font-semibold text-stone-200">{startItem}</span> to{" "}
            <span className="font-semibold text-stone-200">{endItem}</span> of{" "}
            <span className="font-semibold text-stone-200">{totalCount}</span> orders
          </div>

          <div className="flex items-center gap-2">
            <button
              id="orders-prev-page"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-300 text-xs font-medium border border-stone-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <span className="text-xs text-stone-400 px-2">
              Page <span className="text-stone-200 font-medium">{page}</span> of{" "}
              <span className="text-stone-200 font-medium">{totalPages}</span>
            </span>

            <button
              id="orders-next-page"
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-300 text-xs font-medium border border-stone-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
