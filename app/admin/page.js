import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin/auth";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

export const metadata = {
  title: "Admin Dashboard | Buzzora",
  robots: { index: false, follow: false },
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default async function AdminDashboardPage() {
  const adminContext = await getAdminContext();

  if (!adminContext.authenticated) {
    redirect("/admin/login");
  }

  if (!adminContext.authorized) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full bg-stone-900 border border-red-900/60 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-950/80 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            !
          </div>
          <h1 className="text-xl font-semibold text-stone-100 mb-2">Access Denied</h1>
          <p className="text-sm text-stone-400 mb-6">
            The authenticated account (<span className="text-stone-300 font-mono">{adminContext.email}</span>) does not have administrator privileges.
          </p>
          <AdminSignOutButton className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl border border-stone-700 transition-colors" />
        </div>
      </div>
    );
  }

  let metrics = null;
  try {
    metrics = await getAdminDashboardMetrics(adminContext);
  } catch (err) {
    console.error("[AdminDashboard] Error loading metrics:", err.message);
  }

  const { orders = {}, payments = {}, sales = {} } = metrics || {};

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-black">
      <AdminHeader adminContext={adminContext} currentSection="dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Welcome & Context Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-100 tracking-tight">
              Fulfillment & Sales Operations
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stone-400">
              Authoritative real-time operational status for Buzzora Pure Raw Honey.
            </p>
          </div>
          <Link
            id="admin-btn-manage-orders"
            href="/admin/orders"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
          >
            <span>Manage All Orders</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* Top KPI Cards: Sales & Order Volume */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="text-xs uppercase tracking-wider font-medium text-stone-400">
              Total Confirmed Sales
            </div>
            <div id="metric-total-sales" className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-amber-400">
              {formatCurrency(sales.total)}
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              Excludes pending & cancelled
            </p>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="text-xs uppercase tracking-wider font-medium text-stone-400">
              Today&apos;s Paid Sales
            </div>
            <div id="metric-today-sales" className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-100">
              {formatCurrency(sales.today)}
            </div>
            <p className="mt-1.5 text-xs text-emerald-400/90 font-medium">
              Live today
            </p>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="text-xs uppercase tracking-wider font-medium text-stone-400">
              Total Orders
            </div>
            <div id="metric-total-orders" className="mt-2 text-2xl sm:text-3xl font-semibold text-stone-100">
              {orders.total || 0}
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              All lifetime customer orders
            </p>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="text-xs uppercase tracking-wider font-medium text-stone-400">
              Today&apos;s Orders
            </div>
            <div id="metric-today-orders" className="mt-2 text-2xl sm:text-3xl font-semibold text-stone-100">
              {orders.today || 0}
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              Placed since 00:00 UTC
            </p>
          </div>
        </div>

        {/* Fulfillment Pipeline Breakdown */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-serif font-semibold text-stone-100">
              Fulfillment Pipeline
            </h2>
            <span className="text-xs text-stone-400">
              Click any stage to filter orders
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <Link
              href="/admin/orders?orderStatus=PENDING"
              className="bg-stone-900/60 hover:bg-stone-800/60 border border-amber-900/30 hover:border-amber-500/40 rounded-xl p-4 transition-all group"
            >
              <div className="text-xs uppercase tracking-wider font-medium text-amber-400/80">Pending</div>
              <div id="metric-status-pending" className="mt-2 text-2xl font-semibold text-stone-100 group-hover:text-amber-300">
                {orders.pending || 0}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">Awaiting payment</div>
            </Link>

            <Link
              href="/admin/orders?orderStatus=CONFIRMED"
              className="bg-stone-900/60 hover:bg-stone-800/60 border border-sky-900/30 hover:border-sky-500/40 rounded-xl p-4 transition-all group"
            >
              <div className="text-xs uppercase tracking-wider font-medium text-sky-400/80">Confirmed</div>
              <div id="metric-status-confirmed" className="mt-2 text-2xl font-semibold text-stone-100 group-hover:text-sky-300">
                {orders.confirmed || 0}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">Paid & ready</div>
            </Link>

            <Link
              href="/admin/orders?orderStatus=PROCESSING"
              className="bg-stone-900/60 hover:bg-stone-800/60 border border-purple-900/30 hover:border-purple-500/40 rounded-xl p-4 transition-all group"
            >
              <div className="text-xs uppercase tracking-wider font-medium text-purple-400/80">Processing</div>
              <div id="metric-status-processing" className="mt-2 text-2xl font-semibold text-stone-100 group-hover:text-purple-300">
                {orders.processing || 0}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">Packing jars</div>
            </Link>

            <Link
              href="/admin/orders?orderStatus=SHIPPED"
              className="bg-stone-900/60 hover:bg-stone-800/60 border border-blue-900/30 hover:border-blue-500/40 rounded-xl p-4 transition-all group"
            >
              <div className="text-xs uppercase tracking-wider font-medium text-blue-400/80">Shipped</div>
              <div id="metric-status-shipped" className="mt-2 text-2xl font-semibold text-stone-100 group-hover:text-blue-300">
                {orders.shipped || 0}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">In transit</div>
            </Link>

            <Link
              href="/admin/orders?orderStatus=DELIVERED"
              className="bg-stone-900/60 hover:bg-stone-800/60 border border-emerald-900/30 hover:border-emerald-500/40 rounded-xl p-4 transition-all group"
            >
              <div className="text-xs uppercase tracking-wider font-medium text-emerald-400/80">Delivered</div>
              <div id="metric-status-delivered" className="mt-2 text-2xl font-semibold text-stone-100 group-hover:text-emerald-300">
                {orders.delivered || 0}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">Fulfilled</div>
            </Link>

            <Link
              href="/admin/orders?orderStatus=CANCELLED"
              className="bg-stone-900/60 hover:bg-stone-800/60 border border-stone-800 hover:border-stone-700 rounded-xl p-4 transition-all group"
            >
              <div className="text-xs uppercase tracking-wider font-medium text-stone-400">Cancelled</div>
              <div id="metric-status-cancelled" className="mt-2 text-2xl font-semibold text-stone-300 group-hover:text-white">
                {orders.cancelled || 0}
              </div>
              <div className="mt-1 text-[11px] text-stone-400">Aborted</div>
            </Link>
          </div>
        </div>

        {/* Payment Health Summary */}
        <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6">
          <h2 className="text-base sm:text-lg font-serif font-semibold text-stone-100 mb-4">
            Payment Attempt States
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-900/60 border border-emerald-950">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <div className="text-xs text-stone-400">Successful</div>
                <div id="metric-payments-success" className="text-lg font-semibold text-stone-100">
                  {payments.success || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-900/60 border border-amber-950">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <div>
                <div className="text-xs text-stone-400">Pending Confirmation</div>
                <div id="metric-payments-pending" className="text-lg font-semibold text-stone-100">
                  {payments.pending || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-900/60 border border-red-950">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <div className="text-xs text-stone-400">Failed</div>
                <div id="metric-payments-failed" className="text-lg font-semibold text-stone-100">
                  {payments.failed || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-900/60 border border-stone-800">
              <span className="w-3 h-3 rounded-full bg-stone-500" />
              <div>
                <div className="text-xs text-stone-400">Cancelled</div>
                <div id="metric-payments-cancelled" className="text-lg font-semibold text-stone-100">
                  {payments.cancelled || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
