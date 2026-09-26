import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin/auth";
import { getAdminOrderDetails } from "@/lib/admin/orders";
import AdminHeader from "@/components/admin/AdminHeader";
import FulfillmentActionsCard from "@/components/admin/FulfillmentActionsCard";
import OrderEmailEventsCard from "@/components/admin/OrderEmailEventsCard";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";

export const metadata = {
  title: "Order Details | Buzzora Admin",
  robots: { index: false, follow: false },
};

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
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
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default async function AdminOrderDetailPage({ params }) {
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

  const buzzoraOrderId = params?.id;
  let orderData = null;

  try {
    const result = await getAdminOrderDetails(buzzoraOrderId, adminContext);
    orderData = result.order;
  } catch (err) {
    if (err.statusCode === 404) {
      notFound();
    }
    console.error("[AdminOrderDetailPage] Error fetching order:", err.message);
  }

  if (!orderData) {
    notFound();
  }

  const { customer, shippingAddress, financials, fulfillment, items = [], payments = [], statusHistory = [] } = orderData;
  const latestPayment = payments?.[0] || null;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 selection:bg-amber-500 selection:text-black">
      <AdminHeader adminContext={adminContext} currentSection="orders" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-stone-400 mb-6">
          <Link href="/admin" className="hover:text-stone-200 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/admin/orders" className="hover:text-stone-200 transition-colors">
            Orders
          </Link>
          <span>/</span>
          <span className="text-amber-400 font-mono font-medium">{orderData.buzzoraOrderId}</span>
        </div>

        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif text-stone-100 tracking-tight font-semibold">
                {orderData.buzzoraOrderId}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {orderData.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Placed on {formatDate(orderData.audit?.createdAt)}
            </p>
          </div>
        </div>

        {/* Interactive Fulfillment State Controller */}
        <div className="mb-8">
          <FulfillmentActionsCard order={orderData} />
        </div>

        {/* 2-Column Responsive Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column (2 Cols wide on desktop): Items & Audit */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items Table */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-300 mb-4">
                Order Items ({items.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-900 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Product</th>
                      <th scope="col" className="py-2.5 px-3">SKU / Size</th>
                      <th scope="col" className="py-2.5 px-3 text-center">Qty</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Unit Price</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-stone-800/20">
                        <td className="py-3 px-3 font-medium text-stone-200">
                          {item.productName}
                        </td>
                        <td className="py-3 px-3 text-stone-400 font-mono">
                          {item.sku || item.weight || "-"}
                        </td>
                        <td className="py-3 px-3 text-center text-stone-300 font-medium">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-3 text-right text-stone-400">
                          {formatCurrency(item.unitPrice, financials?.currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-stone-100">
                          {formatCurrency(item.lineTotal, financials?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="mt-4 pt-4 border-t border-stone-800/80 flex flex-col items-end gap-1.5 text-xs">
                <div className="flex justify-between w-48 text-stone-400">
                  <span>Subtotal:</span>
                  <span className="text-stone-300">{formatCurrency(financials?.subtotal, financials?.currency)}</span>
                </div>
                <div className="flex justify-between w-48 text-stone-400">
                  <span>Shipping:</span>
                  <span className="text-stone-300">{formatCurrency(financials?.shippingCost, financials?.currency)}</span>
                </div>
                <div className="flex justify-between w-48 pt-2 border-t border-stone-800 font-bold text-sm text-amber-400">
                  <span>Total:</span>
                  <span>{formatCurrency(financials?.total, financials?.currency)}</span>
                </div>
              </div>
            </div>

            {/* Audit History (Status Timeline) */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-300 mb-4">
                Audit Trail & Status History
              </h2>
              {statusHistory.length === 0 ? (
                <p className="text-xs text-stone-500">
                  No status transition history recorded yet. Initial order creation recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {statusHistory.map((h, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-amber-500/40 pl-3 py-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-300">
                            {h.previousStatus} → <span className="text-amber-400">{h.newStatus}</span>
                          </span>
                        </div>
                        {h.reason && (
                          <div className="text-stone-400 mt-0.5">
                            Reason: <span className="text-stone-300 italic">{h.reason}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-2">
                          <span>By: {h.changedBy || "System"}</span>
                          <span>•</span>
                          <span>{formatDate(h.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (1 Col wide): Customer, Shipping & Payment */}
          <div className="space-y-6">
            {/* Customer Information Card */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Customer Information
              </h2>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-stone-500 text-[11px]">Full Name</div>
                  <div className="text-stone-200 font-medium">{customer?.name || "N/A"}</div>
                </div>
                <div>
                  <div className="text-stone-500 text-[11px]">Email Address</div>
                  <div className="text-stone-200 font-mono">{customer?.email || "N/A"}</div>
                </div>
                <div>
                  <div className="text-stone-500 text-[11px]">Phone Number</div>
                  <div className="text-stone-200 font-mono">{customer?.phone || "N/A"}</div>
                </div>
              </div>
            </div>

            {/* Shipping Address Card */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Shipping Destination
              </h2>
              <div className="space-y-1.5 text-xs text-stone-300 leading-relaxed">
                <div>{shippingAddress?.address}</div>
                <div>
                  {shippingAddress?.city}, {shippingAddress?.state} {shippingAddress?.postcode}
                </div>
                <div className="text-stone-400 uppercase text-[11px]">{shippingAddress?.country || "India"}</div>
              </div>
            </div>

            {/* Payment Details (READ ONLY!) */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Payment Details (Read-Only)
              </h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Provider:</span>
                  <span className="text-stone-200 font-medium uppercase">{latestPayment?.paymentProvider || "PhonePe"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Payment Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    latestPayment?.paymentStatus === "SUCCESS"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/80"
                      : "bg-amber-950/60 text-amber-300 border-amber-800/80"
                  }`}>
                    {latestPayment?.paymentStatus || (orderData.status === "CONFIRMED" ? "SUCCESS" : "PENDING")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Merchant Tx ID:</span>
                  <span className="text-stone-300 font-mono text-[11px]">
                    {latestPayment?.merchantTransactionId || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Provider Tx ID:</span>
                  <span className="text-stone-300 font-mono text-[11px]">
                    {latestPayment?.providerTransactionId || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Paid Timestamp:</span>
                  <span className="text-stone-300 text-[11px]">
                    {formatDate(latestPayment?.paidAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Email Event Status & Retry Controls */}
            <OrderEmailEventsCard order={orderData} />

            {/* Courier & Tracking Summary Card */}
            <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Fulfillment Information
              </h2>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-stone-500 text-[11px]">Courier Partner</div>
                  <div className="text-stone-200 font-medium">{fulfillment?.courierName || "Not assigned yet"}</div>
                </div>
                <div>
                  <div className="text-stone-500 text-[11px]">Tracking Number</div>
                  <div className="text-stone-200 font-mono">{fulfillment?.trackingNumber || "N/A"}</div>
                </div>
                {fulfillment?.trackingUrl && (
                  <div>
                    <div className="text-stone-500 text-[11px]">Direct Tracking Link</div>
                    <a
                      href={fulfillment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 underline font-medium truncate block max-w-full"
                    >
                      Track Package →
                    </a>
                  </div>
                )}
                <div>
                  <div className="text-stone-500 text-[11px]">Shipped Timestamp</div>
                  <div className="text-stone-300">{formatDate(fulfillment?.shippedAt)}</div>
                </div>
                <div>
                  <div className="text-stone-500 text-[11px]">Delivered Timestamp</div>
                  <div className="text-stone-300">{formatDate(fulfillment?.deliveredAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
