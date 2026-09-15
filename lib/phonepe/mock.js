import { createServerSupabaseClient } from "../supabase/server.js";

// ============================================================================
// Development-Only PhonePe Mock Provider
// Strictly disabled in production (NODE_ENV === "production").
// ============================================================================

/**
 * Returns true ONLY when NODE_ENV is NOT production AND PHONEPE_MOCK_MODE === "true".
 * Guarantees that mock mode can NEVER be activated in production under any circumstances.
 */
export function isPhonePeMockModeEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.PHONEPE_MOCK_MODE === "true";
}

/**
 * Initiates a mock payment request for local development testing.
 * Returns a local mock checkout URL (/api/phonepe/mock-checkout?merchantOrderId=...)
 */
export async function initiateMockPhonePePayment({ merchantOrderId, amountInPaisa, redirectUrl }) {
  if (!isPhonePeMockModeEnabled()) {
    throw new Error("Mock payment initiation is disabled in this environment.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const mockCheckoutUrl = `${cleanSiteUrl}/api/phonepe/mock-checkout?merchantOrderId=${encodeURIComponent(
    merchantOrderId
  )}`;

  return {
    success: true,
    merchantOrderId,
    redirectUrl: mockCheckoutUrl,
    tokenUrl: mockCheckoutUrl,
    isMock: true,
  };
}

/**
 * Queries mock payment status from Supabase public.payments table for local development testing.
 */
export async function getMockPhonePeOrderStatus(merchantOrderId) {
  if (!merchantOrderId || typeof merchantOrderId !== "string") {
    throw new Error("merchantOrderId is required for mock status check.");
  }

  const supabase = createServerSupabaseClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, order_id, merchant_transaction_id, amount, payment_status, provider_transaction_id")
    .eq("merchant_transaction_id", merchantOrderId.trim())
    .single();

  if (error || !payment) {
    return {
      success: false,
      merchantOrderId,
      state: "NOT_FOUND",
      code: "PAYMENT_NOT_FOUND",
      isSuccess: false,
      isFailed: true,
      amount: null,
      providerTransactionId: null,
    };
  }

  const amountInPaisa = Math.round(Number(payment.amount) * 100);
  const isSuccess = payment.payment_status === "SUCCESS";
  const isFailed = payment.payment_status === "FAILED";

  return {
    success: true,
    merchantOrderId,
    state: isSuccess ? "COMPLETED" : isFailed ? "FAILED" : "PENDING",
    code: isSuccess ? "PAYMENT_SUCCESS" : isFailed ? "PAYMENT_FAILED" : "PAYMENT_PENDING",
    isSuccess,
    isFailed,
    amount: amountInPaisa,
    providerTransactionId: payment.provider_transaction_id || `MOCK_TX_${payment.id.slice(0, 8)}`,
    rawResponse: {
      mock: true,
      paymentStatus: payment.payment_status,
      merchantOrderId,
    },
  };
}

/**
 * Simulates an internal server-side PhonePe S2S webhook invocation for development testing.
 */
export async function simulateMockWebhook({ merchantOrderId, event }) {
  if (!isPhonePeMockModeEnabled()) {
    throw new Error("Mock webhook simulation is disabled in production.");
  }

  const supabase = createServerSupabaseClient();
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("id, order_id, merchant_transaction_id, amount, payment_status")
    .eq("merchant_transaction_id", merchantOrderId.trim())
    .single();

  if (payErr || !payment) {
    return { success: false, error: "Payment attempt not found." };
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status")
    .eq("id", payment.order_id)
    .single();

  if (orderErr || !order) {
    return { success: false, error: "Associated order not found." };
  }

  // Terminal SUCCESS protection
  if (payment.payment_status === "SUCCESS") {
    return { success: true, message: "Payment already processed as SUCCESS.", isDuplicate: true };
  }

  const nowIso = new Date().toISOString();
  const mockTxId = `MOCK_TX_${Date.now()}`;

  if (event === "checkout.order.completed") {
    // 1. Update payment to SUCCESS
    const { error: payUpdateErr } = await supabase
      .from("payments")
      .update({
        payment_status: "SUCCESS",
        provider_transaction_id: mockTxId,
        paid_at: nowIso,
        provider_response: { event, source: "mock_sandbox", updatedAt: nowIso },
      })
      .eq("id", payment.id)
      .neq("payment_status", "SUCCESS");

    if (payUpdateErr) throw payUpdateErr;

    // 2. Update order to CONFIRMED
    if (order.status === "PENDING") {
      const { error: orderUpdateErr } = await supabase
        .from("orders")
        .update({ status: "CONFIRMED" })
        .eq("id", order.id)
        .eq("status", "PENDING");

      if (orderUpdateErr) throw orderUpdateErr;
    }

    return { success: true, buzzoraOrderId: order.buzzora_order_id, status: "CONFIRMED" };
  }

  if (event === "checkout.order.failed" || event === "USER_CANCEL") {
    if (payment.payment_status === "PENDING") {
      await supabase
        .from("payments")
        .update({
          payment_status: "FAILED",
          provider_response: { event, source: "mock_sandbox", updatedAt: nowIso },
        })
        .eq("id", payment.id)
        .eq("payment_status", "PENDING");
    }

    // Keep order PENDING
    return { success: true, buzzoraOrderId: order.buzzora_order_id, status: "PENDING" };
  }

  return { success: false, error: `Unhandled mock event: ${event}` };
}
