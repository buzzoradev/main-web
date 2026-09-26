import { createServerSupabaseClient } from "../supabase/server.js";
import { assertAdminAuthorized } from "./orders.js";

/**
 * Server-Authoritative Admin Dashboard Metrics Service.
 *
 * Operational Metrics:
 * 1. Order Status Counts (Total, Today, Pending, Confirmed, Processing, Shipped, Delivered, Cancelled)
 * 2. Payment Status Counts (Success, Pending, Failed, Cancelled)
 * 3. Confirmed Paid Sales (Total, Today)
 *
 * Strict Security Rules:
 * - Requires privileged administrative authorization.
 * - Confirmed Paid Sales count ONLY orders in confirmed fulfillment states ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED').
 * - PENDING, FAILED, and CANCELLED orders are strictly excluded from sales metrics.
 * - All aggregations are performed server-side with zero client-side calculation.
 *
 * @param {Object|Request|string} adminContext - Admin session context
 * @returns {Promise<Object>} Operational metrics summary
 */
export async function getAdminDashboardMetrics(adminContext) {
  await assertAdminAuthorized(adminContext);

  const supabase = createServerSupabaseClient();

  // Calculate start of today in UTC
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayIso = startOfToday.toISOString();

  // Concurrently execute head-count and selective total aggregations
  const [
    totalOrdersRes,
    todayOrdersRes,
    pendingOrdersRes,
    confirmedOrdersRes,
    processingOrdersRes,
    shippedOrdersRes,
    deliveredOrdersRes,
    cancelledOrdersRes,
    successPaymentsRes,
    pendingPaymentsRes,
    failedPaymentsRes,
    cancelledPaymentsRes,
    totalSalesRes,
    todaySalesRes,
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", startOfTodayIso),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "CONFIRMED"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "PROCESSING"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "SHIPPED"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "DELIVERED"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "CANCELLED"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("payment_status", "SUCCESS"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("payment_status", "PENDING"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("payment_status", "FAILED"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("payment_status", "CANCELLED"),
    supabase.from("orders").select("total").in("status", ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]),
    supabase.from("orders").select("total").in("status", ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]).gte("created_at", startOfTodayIso),
  ]);

  const totalPaidSales = (totalSalesRes?.data || []).reduce(
    (acc, order) => acc + Number(order.total || 0),
    0
  );

  const todayPaidSales = (todaySalesRes?.data || []).reduce(
    (acc, order) => acc + Number(order.total || 0),
    0
  );

  return {
    orders: {
      total: totalOrdersRes.count || 0,
      today: todayOrdersRes.count || 0,
      pending: pendingOrdersRes.count || 0,
      confirmed: confirmedOrdersRes.count || 0,
      processing: processingOrdersRes.count || 0,
      shipped: shippedOrdersRes.count || 0,
      delivered: deliveredOrdersRes.count || 0,
      cancelled: cancelledOrdersRes.count || 0,
    },
    payments: {
      success: successPaymentsRes.count || 0,
      pending: pendingPaymentsRes.count || 0,
      failed: failedPaymentsRes.count || 0,
      cancelled: cancelledPaymentsRes.count || 0,
    },
    sales: {
      total: totalPaidSales,
      today: todayPaidSales,
      currency: "INR",
    },
    generatedAt: new Date().toISOString(),
  };
}
