import { createServerSupabaseClient } from "../supabase/server.js";
import { assertAdminAuthorized } from "./orders.js";
import { getPhonePeOrderStatus } from "../phonepe/server.js";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_RESULTS } from "./audit.js";
import { sendOrderConfirmationEmail } from "../email/service.js";

/**
 * Authoritative payment reconciliation classification categories.
 */
export const RECONCILIATION_STATUS = {
  HEALTHY: "HEALTHY",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  ORDER_PAYMENT_MISMATCH: "ORDER_PAYMENT_MISMATCH",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
  MULTIPLE_SUCCESS_PAYMENTS: "MULTIPLE_SUCCESS_PAYMENTS",
  PROVIDER_STATUS_MISMATCH: "PROVIDER_STATUS_MISMATCH",
  REQUIRES_RECONCILIATION: "REQUIRES_RECONCILIATION",
};

/**
 * Sanitizes and normalizes an administrative search term.
 * Protects against SQL injection, wildcard injection, and excessively long inputs.
 */
function sanitizeSearchQuery(query) {
  if (!query || typeof query !== "string") return "";
  return query
    .trim()
    .replace(/[%_,();"'\\*]/g, "")
    .slice(0, 50);
}

/**
 * Validates whether a given string is a valid UUIDv4.
 */
export function isValidUUID(id) {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * Sanitizes a database payment record for safe exposure in administrative APIs.
 * Eliminates all internal secrets, client credentials, and raw authentication headers.
 *
 * @param {Object} payment
 * @returns {Object} Clean presentation payment model
 */
export function sanitizePaymentRecord(payment) {
  if (!payment) return null;

  // Extract safe subset of provider_response
  let safeProviderResponse = null;
  if (payment.provider_response && typeof payment.provider_response === "object") {
    safeProviderResponse = {
      event: payment.provider_response.event || null,
      state: payment.provider_response.state || null,
      code: payment.provider_response.code || null,
      source: payment.provider_response.source || null,
      verifiedAmount: payment.provider_response.verifiedAmount || null,
      updatedAt: payment.provider_response.updatedAt || null,
      reconciledAt: payment.provider_response.reconciledAt || null,
      reconciledBy: payment.provider_response.reconciledBy || null,
    };
  }

  return {
    id: payment.id,
    orderId: payment.order_id,
    buzzoraOrderId: payment.orders?.buzzora_order_id || null,
    merchantTransactionId: payment.merchant_transaction_id,
    paymentProvider: payment.payment_provider || "phonepe",
    providerTransactionId: payment.provider_transaction_id || null,
    amount: Number(payment.amount),
    currency: payment.currency || "INR",
    paymentStatus: payment.payment_status,
    paidAt: payment.paid_at || null,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
    providerResponse: safeProviderResponse,
    order: payment.orders
      ? {
          id: payment.orders.id,
          buzzoraOrderId: payment.orders.buzzora_order_id,
          status: payment.orders.status,
          total: Number(payment.orders.total),
          currency: payment.orders.currency || "INR",
          customerName: payment.orders.customer_name,
          customerEmail: payment.orders.customer_email,
          customerPhone: payment.orders.customer_phone,
        }
      : null,
  };
}

/**
 * Evaluates the consistency relationship between an order, a payment attempt,
 * and all sibling payment attempts for that order.
 *
 * Identifies:
 * - Order is CONFIRMED/beyond but has no SUCCESS payment
 * - Order is PENDING but payment is SUCCESS
 * - Multiple SUCCESS payments exist for the same order
 * - Payment amount does not equal authoritative order total
 * - Payment currency does not match order currency
 * - Payment is SUCCESS but provider_transaction_id is missing
 *
 * @param {Object} order - Authoritative order record
 * @param {Object} payment - Current payment attempt record
 * @param {Array<Object>} [siblingPayments=[]] - All payment attempts for this order
 * @returns {{
 *   classification: string,
 *   isConsistent: boolean,
 *   requiresReconciliation: boolean,
 *   issues: string[],
 *   details: Object
 * }}
 */
export function analyzePaymentConsistency(order, payment, siblingPayments = []) {
  const issues = [];
  let classification = RECONCILIATION_STATUS.HEALTHY;

  if (!order || !payment) {
    return {
      classification: RECONCILIATION_STATUS.REQUIRES_RECONCILIATION,
      isConsistent: false,
      requiresReconciliation: true,
      issues: ["Missing order or payment record for consistency analysis."],
      details: {},
    };
  }

  const orderTotal = Number(order.total);
  const paymentAmount = Number(payment.amount);
  const orderCurrency = (order.currency || "INR").toUpperCase();
  const paymentCurrency = (payment.currency || "INR").toUpperCase();

  // 1. Currency Check
  const currencyMatches = orderCurrency === paymentCurrency;
  if (!currencyMatches) {
    issues.push(`Currency mismatch: Order is '${orderCurrency}', but payment is '${paymentCurrency}'.`);
    classification = RECONCILIATION_STATUS.CURRENCY_MISMATCH;
  }

  // 2. Amount Check
  const amountDifference = Math.abs(orderTotal - paymentAmount);
  const amountMatches = amountDifference < 0.01;
  if (!amountMatches) {
    issues.push(`Amount mismatch: Order total is ₹${orderTotal.toFixed(2)}, but payment amount is ₹${paymentAmount.toFixed(2)}.`);
    classification = RECONCILIATION_STATUS.AMOUNT_MISMATCH;
  }

  // 3. Multiple SUCCESS Payments Check
  const allAttempts = siblingPayments.length > 0 ? siblingPayments : [payment];
  const successAttempts = allAttempts.filter((p) => p.payment_status === "SUCCESS");
  if (successAttempts.length > 1) {
    issues.push(`Multiple SUCCESS payments detected: Found ${successAttempts.length} successful payment attempts for order '${order.buzzora_order_id}'.`);
    classification = RECONCILIATION_STATUS.MULTIPLE_SUCCESS_PAYMENTS;
  }

  // 4. Order vs Payment Status Matrix
  const isOrderConfirmedOrBeyond = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status);
  const hasAnySuccessPayment = successAttempts.length > 0;

  if (isOrderConfirmedOrBeyond && !hasAnySuccessPayment) {
    issues.push(`Order status is '${order.status}', but no payment record has reached SUCCESS status.`);
    if (classification === RECONCILIATION_STATUS.HEALTHY) {
      classification = RECONCILIATION_STATUS.ORDER_PAYMENT_MISMATCH;
    }
  }

  if (order.status === "PENDING" && payment.payment_status === "SUCCESS") {
    issues.push(`Payment '${payment.merchant_transaction_id}' is SUCCESS, but Order status is still PENDING.`);
    if (classification === RECONCILIATION_STATUS.HEALTHY) {
      classification = RECONCILIATION_STATUS.ORDER_PAYMENT_MISMATCH;
    }
  }

  // 5. Provider Transaction ID Completeness
  if (payment.payment_status === "SUCCESS" && !payment.provider_transaction_id) {
    issues.push(`Payment status is SUCCESS, but provider_transaction_id is missing.`);
    if (classification === RECONCILIATION_STATUS.HEALTHY) {
      classification = RECONCILIATION_STATUS.PROVIDER_STATUS_MISMATCH;
    }
  }

  // Default classification if no critical mismatches found
  if (classification === RECONCILIATION_STATUS.HEALTHY) {
    if (payment.payment_status === "PENDING") {
      classification = RECONCILIATION_STATUS.PAYMENT_PENDING;
    } else if (payment.payment_status === "FAILED") {
      classification = RECONCILIATION_STATUS.PAYMENT_FAILED;
    }
  }

  const isConsistent = issues.length === 0;
  const requiresReconciliation =
    classification === RECONCILIATION_STATUS.ORDER_PAYMENT_MISMATCH ||
    classification === RECONCILIATION_STATUS.PROVIDER_STATUS_MISMATCH ||
    classification === RECONCILIATION_STATUS.PAYMENT_PENDING;

  return {
    classification,
    isConsistent,
    requiresReconciliation,
    issues,
    details: {
      orderId: order.id,
      buzzoraOrderId: order.buzzora_order_id,
      orderStatus: order.status,
      orderTotal,
      orderCurrency,
      paymentAmount,
      paymentCurrency,
      paymentStatus: payment.payment_status,
      successPaymentsCount: successAttempts.length,
      totalPaymentsCount: allAttempts.length,
      amountMatches,
      currencyMatches,
      hasSuccessPayment: hasAnySuccessPayment,
    },
  };
}

/**
 * Retrieves a paginated, searchable, and filterable list of payments for administrative operations.
 *
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=25]
 * @param {string} [params.search=""]
 * @param {string} [params.paymentStatus="ALL"]
 * @param {string} [params.reconciliationFilter="ALL"]
 * @param {Object} params.adminContext
 * @returns {Promise<Object>} Paginated payments result with consistency metrics
 */
export async function getAdminPaymentsList({
  page = 1,
  pageSize = 25,
  search = "",
  paymentStatus = "ALL",
  reconciliationFilter = "ALL",
  adminContext,
}) {
  await assertAdminAuthorized(adminContext);

  const cleanPage = Math.max(1, parseInt(page, 10) || 1);
  const cleanPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const from = (cleanPage - 1) * cleanPageSize;
  const to = from + cleanPageSize - 1;

  const cleanSearch = sanitizeSearchQuery(search);
  const normalizedPaymentStatus = (paymentStatus || "ALL").trim().toUpperCase();
  const normalizedReconciliationFilter = (reconciliationFilter || "ALL").trim().toUpperCase();

  const supabase = createServerSupabaseClient();

  const selectString = `
    id, order_id, merchant_transaction_id, payment_provider, provider_transaction_id,
    amount, currency, payment_status, provider_response, paid_at, created_at, updated_at,
    orders!inner(id, buzzora_order_id, status, total, currency, customer_name, customer_email, customer_phone)
  `;

  let query = supabase
    .from("payments")
    .select(selectString, { count: "exact" })
    .order("created_at", { ascending: false });

  if (cleanSearch) {
    let matchedOrderIds = [];
    try {
      const { data: matchedOrders } = await supabase
        .from("orders")
        .select("id")
        .or(`buzzora_order_id.ilike.*${cleanSearch}*,customer_email.ilike.*${cleanSearch}*,customer_phone.ilike.*${cleanSearch}*,customer_name.ilike.*${cleanSearch}*`)
        .limit(50);
      matchedOrderIds = (matchedOrders || []).map((o) => o.id);
    } catch {
      // Fallback
    }

    if (matchedOrderIds.length > 0) {
      query = query.or(
        `merchant_transaction_id.ilike.*${cleanSearch}*,provider_transaction_id.ilike.*${cleanSearch}*,order_id.in.(${matchedOrderIds.join(",")})`
      );
    } else {
      query = query.or(
        `merchant_transaction_id.ilike.*${cleanSearch}*,provider_transaction_id.ilike.*${cleanSearch}*`
      );
    }
  }

  if (normalizedPaymentStatus !== "ALL" && ["PENDING", "SUCCESS", "FAILED", "CANCELLED"].includes(normalizedPaymentStatus)) {
    query = query.eq("payment_status", normalizedPaymentStatus);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[getAdminPaymentsList] Query error:", error.message);
    const err = new Error("Failed to load payment records from database.");
    err.statusCode = 500;
    throw err;
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / cleanPageSize) || 1;

  // Enhance each payment with consistency analysis
  const payments = (data || []).map((p) => {
    const sanitized = sanitizePaymentRecord(p);
    const consistency = analyzePaymentConsistency(p.orders, p, [p]);
    return {
      ...sanitized,
      consistency,
    };
  });

  // Apply optional in-memory filter if specific reconciliation category was requested
  let filteredPayments = payments;
  if (normalizedReconciliationFilter !== "ALL") {
    filteredPayments = payments.filter((p) => p.consistency.classification === normalizedReconciliationFilter);
  }

  return {
    payments: filteredPayments,
    pagination: {
      page: cleanPage,
      pageSize: cleanPageSize,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Retrieves detailed administrative view of a specific payment attempt including
 * parent order details, sibling payment attempts, consistency analysis, and audit log.
 *
 * @param {string} paymentId - UUID of the payment record
 * @param {Object} adminContext - Authenticated admin context
 * @returns {Promise<Object>} Detailed payment model
 */
export async function getAdminPaymentDetails(paymentId, adminContext) {
  await assertAdminAuthorized(adminContext);

  if (!isValidUUID(paymentId)) {
    const error = new Error("Invalid payment ID format. Must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  const supabase = createServerSupabaseClient();

  // 1. Fetch target payment attempt
  const { data: payment, error: payError } = await supabase
    .from("payments")
    .select(`
      id, order_id, merchant_transaction_id, payment_provider, provider_transaction_id,
      amount, currency, payment_status, provider_response, paid_at, created_at, updated_at,
      orders(id, buzzora_order_id, status, total, currency, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, created_at)
    `)
    .eq("id", paymentId.trim())
    .single();

  if (payError || !payment) {
    const error = new Error("Payment record not found.");
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch all sibling payment attempts for this order to inspect complete history
  const { data: siblingAttempts } = await supabase
    .from("payments")
    .select("id, merchant_transaction_id, payment_provider, provider_transaction_id, amount, currency, payment_status, paid_at, created_at")
    .eq("order_id", payment.order_id)
    .order("created_at", { ascending: false });

  // 3. Fetch line items for financial context
  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, size_sku, quantity, unit_price, line_total")
    .eq("order_id", payment.order_id);

  // 4. Fetch reconciliation audit records for this payment (if audit table exists)
  let reconciliationAudit = [];
  try {
    const { data: auditData } = await supabase
      .from("payment_reconciliation_audit")
      .select("*")
      .eq("payment_id", payment.id)
      .order("created_at", { ascending: false });
    if (Array.isArray(auditData)) reconciliationAudit = auditData;
  } catch {
    // Non-blocking fallback if migration 009 has not been executed remotely yet
  }

  const consistency = analyzePaymentConsistency(payment.orders, payment, siblingAttempts || []);
  const sanitizedPayment = sanitizePaymentRecord(payment);

  return {
    payment: {
      ...sanitizedPayment,
      consistency,
      siblingAttempts: (siblingAttempts || []).map((s) => ({
        id: s.id,
        merchantTransactionId: s.merchant_transaction_id,
        paymentProvider: s.payment_provider,
        providerTransactionId: s.provider_transaction_id,
        amount: Number(s.amount),
        currency: s.currency,
        paymentStatus: s.payment_status,
        paidAt: s.paid_at,
        createdAt: s.created_at,
      })),
      orderItems: (items || []).map((i) => ({
        id: i.id,
        productName: i.product_name,
        sku: i.size_sku,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        lineTotal: Number(i.line_total),
      })),
      reconciliationAudit: reconciliationAudit.map((a) => ({
        id: a.id,
        action: a.action,
        previousPaymentStatus: a.previous_payment_status,
        providerStatusObserved: a.provider_status_observed,
        resultingPaymentStatus: a.resulting_payment_status,
        orderStatusUpdated: a.order_status_updated,
        reconciliationResult: a.reconciliation_result,
        adminEmail: a.admin_email,
        createdAt: a.created_at,
      })),
    },
  };
}

/**
 * Reconciles a payment attempt directly with the PhonePe gateway.
 * Strictly queries the authoritative PhonePe server status endpoint.
 *
 * Rules:
 * - Never trusts client-supplied amounts or statuses.
 * - Confirms COMPLETED status from PhonePe.
 * - Verifies that the verified amount in paise equals Math.round(order.total * 100).
 * - If verified, updates payment to SUCCESS and (if order is PENDING) updates order to CONFIRMED.
 * - Never promotes an order to PROCESSING/SHIPPED/DELIVERED.
 * - Safely logs immutable audit entry into payment_reconciliation_audit.
 *
 * @param {Object} params
 * @param {string} params.paymentId - UUID of the payment record
 * @param {Object} params.adminContext - Authenticated admin context
 * @returns {Promise<Object>} Reconciliation result
 */
export async function reconcilePaymentWithProvider({ paymentId, adminContext }) {
  const verifiedContext = await assertAdminAuthorized(adminContext);

  if (!isValidUUID(paymentId)) {
    const error = new Error("Invalid payment ID format.");
    error.statusCode = 400;
    throw error;
  }

  const supabase = createServerSupabaseClient();

  // 1. Fetch payment and associated authoritative order
  const { data: payment, error: payError } = await supabase
    .from("payments")
    .select("id, order_id, merchant_transaction_id, payment_provider, provider_transaction_id, amount, currency, payment_status")
    .eq("id", paymentId.trim())
    .single();

  if (payError || !payment) {
    const error = new Error("Payment record not found.");
    error.statusCode = 404;
    throw error;
  }

  if (payment.payment_provider !== "phonepe") {
    const error = new Error(`Reconciliation for provider '${payment.payment_provider}' is not supported. Only 'phonepe' is supported.`);
    error.statusCode = 400;
    throw error;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status, total, currency")
    .eq("id", payment.order_id)
    .single();

  if (orderError || !order) {
    const error = new Error("Associated order record not found.");
    error.statusCode = 404;
    throw error;
  }

  const orderTotal = Number(order.total);
  const expectedPaisa = Math.round(orderTotal * 100);
  const previousStatus = payment.payment_status;

  // 2. Query Authoritative PhonePe Gateway Status API
  let providerResult;
  try {
    providerResult = await getPhonePeOrderStatus(payment.merchant_transaction_id);
  } catch (err) {
    console.error(`[Reconcile] Failed status query with PhonePe:`, err.message);
    const error = new Error(`PhonePe status query failed: ${err.message}`);
    error.statusCode = 502;
    throw error;
  }

  const nowIso = new Date().toISOString();
  const providerState = providerResult.state || "UNKNOWN";
  const verifiedPaisa = providerResult.amount;
  const providerTxId = providerResult.providerTransactionId || payment.provider_transaction_id;

  // 3. CASE A: Provider confirms COMPLETED / SUCCESS
  if (providerResult.isSuccess) {
    // Critical Amount Verification
    if (verifiedPaisa !== null && verifiedPaisa !== expectedPaisa) {
      const alertMsg = `Amount mismatch detected! PhonePe verified: ₹${(verifiedPaisa / 100).toFixed(2)}, DB Order: ₹${orderTotal.toFixed(2)}.`;
      console.error(`[Reconcile Security Alert]: ${alertMsg}`);

      // Log audit
      await recordReconciliationAudit({
        supabase,
        paymentId: payment.id,
        orderId: order.id,
        adminId: verifiedContext.adminId,
        adminEmail: verifiedContext.email,
        action: "RECONCILE_CHECK",
        previousStatus,
        providerStatusObserved: providerState,
        resultingStatus: previousStatus,
        orderStatusUpdated: false,
        reconciliationResult: RECONCILIATION_STATUS.AMOUNT_MISMATCH,
        details: { expectedPaisa, verifiedPaisa, error: alertMsg },
      });

      // Record unified admin audit log
      await recordAdminAudit({
        adminContext: verifiedContext,
        action: AUDIT_ACTIONS.PAYMENT_MISMATCH_DETECTED,
        resourceType: RESOURCE_TYPES.PAYMENT,
        resourceId: payment.merchant_transaction_id,
        orderId: order.id,
        paymentId: payment.id,
        previousState: { status: previousStatus, amount: payment.amount },
        newState: { verifiedAmount: verifiedPaisa ? verifiedPaisa / 100 : null },
        result: AUDIT_RESULTS.CONFLICT,
        reason: alertMsg,
      });

      const mismatchError = new Error(`Reconciliation aborted: Amount mismatch. PhonePe verified amount (₹${(verifiedPaisa / 100).toFixed(2)}) does not match order total (₹${orderTotal.toFixed(2)}).`);
      mismatchError.statusCode = 409;
      mismatchError.classification = RECONCILIATION_STATUS.AMOUNT_MISMATCH;
      throw mismatchError;
    }

    // Idempotency: If already SUCCESS and order is not PENDING
    if (payment.payment_status === "SUCCESS" && order.status !== "PENDING") {
      return {
        success: true,
        isIdempotent: true,
        paymentId: payment.id,
        buzzoraOrderId: order.buzzora_order_id,
        paymentStatus: "SUCCESS",
        orderStatus: order.status,
        providerState,
        classification: RECONCILIATION_STATUS.HEALTHY,
        message: "Payment and Order are already consistent and verified as SUCCESS.",
      };
    }

    // Atomically synchronize payment to SUCCESS
    const { error: payUpdateErr } = await supabase
      .from("payments")
      .update({
        payment_status: "SUCCESS",
        provider_transaction_id: providerTxId,
        paid_at: nowIso,
        provider_response: {
          reconciled: true,
          reconciledBy: verifiedContext.email || verifiedContext.adminId,
          reconciledAt: nowIso,
          state: providerState,
          code: providerResult.code,
          verifiedAmount: verifiedPaisa,
        },
        updated_at: nowIso,
      })
      .eq("id", payment.id);

    if (payUpdateErr) {
      const error = new Error("Failed to update payment status in database.");
      error.statusCode = 500;
      throw error;
    }

    // Atomically synchronize order to CONFIRMED (if it was PENDING)
    let orderUpdated = false;
    if (order.status === "PENDING") {
      const { error: orderUpdateErr } = await supabase
        .from("orders")
        .update({
          status: "CONFIRMED",
          updated_at: nowIso,
        })
        .eq("id", order.id)
        .eq("status", "PENDING");

      if (!orderUpdateErr) {
        orderUpdated = true;
        // Non-blocking transactional confirmation email trigger
        sendOrderConfirmationEmail({
          orderId: order.id,
          buzzoraOrderId: order.buzzora_order_id,
        }).catch((emailErr) => {
          console.warn("[Reconciliation Email Warning]:", emailErr.message);
        });
      }
    }

    // Record audit event
    await recordReconciliationAudit({
      supabase,
      paymentId: payment.id,
      orderId: order.id,
      adminId: verifiedContext.adminId,
      adminEmail: verifiedContext.email,
      action: "RECONCILE_SUCCESS",
      previousStatus,
      providerStatusObserved: providerState,
      resultingStatus: "SUCCESS",
      orderStatusUpdated: orderUpdated,
      reconciliationResult: "SYNCHRONIZED_SUCCESS",
      details: { verifiedPaisa, providerTxId },
    });

    // Record unified admin audit log
    await recordAdminAudit({
      adminContext: verifiedContext,
      action: AUDIT_ACTIONS.PAYMENT_RECONCILIATION_SUCCEEDED,
      resourceType: RESOURCE_TYPES.PAYMENT,
      resourceId: payment.merchant_transaction_id,
      orderId: order.id,
      paymentId: payment.id,
      previousState: { status: previousStatus },
      newState: { status: "SUCCESS", orderUpdated },
      result: AUDIT_RESULTS.SUCCESS,
      reason: "Payment reconciled and verified with PhonePe.",
    });

    return {
      success: true,
      isIdempotent: false,
      paymentId: payment.id,
      buzzoraOrderId: order.buzzora_order_id,
      previousPaymentStatus: previousStatus,
      paymentStatus: "SUCCESS",
      orderStatusUpdated: orderUpdated,
      newOrderStatus: orderUpdated ? "CONFIRMED" : order.status,
      providerState,
      classification: RECONCILIATION_STATUS.HEALTHY,
      message: "Payment successfully reconciled with PhonePe and synchronized to SUCCESS.",
    };
  }

  // 4. CASE B: Provider returned FAILED / TIMED_OUT / DECLINED
  if (providerResult.isFailed) {
    if (payment.payment_status === "PENDING") {
      await supabase
        .from("payments")
        .update({
          payment_status: "FAILED",
          provider_response: {
            reconciled: true,
            reconciledBy: verifiedContext.email || verifiedContext.adminId,
            reconciledAt: nowIso,
            state: providerState,
            code: providerResult.code,
          },
          updated_at: nowIso,
        })
        .eq("id", payment.id)
        .eq("payment_status", "PENDING");
    }

    await recordReconciliationAudit({
      supabase,
      paymentId: payment.id,
      orderId: order.id,
      adminId: verifiedContext.adminId,
      adminEmail: verifiedContext.email,
      action: "RECONCILE_FAILED",
      previousStatus,
      providerStatusObserved: providerState,
      resultingStatus: "FAILED",
      orderStatusUpdated: false,
      reconciliationResult: RECONCILIATION_STATUS.PAYMENT_FAILED,
      details: { providerState, code: providerResult.code },
    });

    // Record unified admin audit log
    await recordAdminAudit({
      adminContext: verifiedContext,
      action: AUDIT_ACTIONS.PAYMENT_RECONCILIATION_FAILED,
      resourceType: RESOURCE_TYPES.PAYMENT,
      resourceId: payment.merchant_transaction_id,
      orderId: order.id,
      paymentId: payment.id,
      previousState: { status: previousStatus },
      newState: { status: "FAILED" },
      result: AUDIT_RESULTS.FAILURE,
      reason: `PhonePe reported state: ${providerState}`,
    });

    return {
      success: true,
      isIdempotent: false,
      paymentId: payment.id,
      buzzoraOrderId: order.buzzora_order_id,
      previousPaymentStatus: previousStatus,
      paymentStatus: "FAILED",
      orderStatusUpdated: false,
      newOrderStatus: order.status,
      providerState,
      classification: RECONCILIATION_STATUS.PAYMENT_FAILED,
      message: `PhonePe confirmed payment attempt has FAILED (${providerState}).`,
    };
  }

  // 5. CASE C: Provider reports still PENDING / IN_PROGRESS
  await recordReconciliationAudit({
    supabase,
    paymentId: payment.id,
    orderId: order.id,
    adminId: verifiedContext.adminId,
    adminEmail: verifiedContext.email,
    action: "RECONCILE_PENDING",
    previousStatus,
    providerStatusObserved: providerState,
    resultingStatus: previousStatus,
    orderStatusUpdated: false,
    reconciliationResult: RECONCILIATION_STATUS.PAYMENT_PENDING,
    details: { providerState },
  });

  return {
    success: true,
    isIdempotent: true,
    paymentId: payment.id,
    buzzoraOrderId: order.buzzora_order_id,
    paymentStatus: previousStatus,
    orderStatusUpdated: false,
    newOrderStatus: order.status,
    providerState,
    classification: RECONCILIATION_STATUS.PAYMENT_PENDING,
    message: `Payment is still ${providerState} at PhonePe. Customer has not completed payment.`,
  };
}

/**
 * Helper to record reconciliation audit events safely.
 * Non-blocking if table is not yet present on remote DB.
 */
async function recordReconciliationAudit({
  supabase,
  paymentId,
  orderId,
  adminId,
  adminEmail,
  action,
  previousStatus,
  providerStatusObserved,
  resultingStatus,
  orderStatusUpdated,
  reconciliationResult,
  details,
}) {
  try {
    await supabase.from("payment_reconciliation_audit").insert({
      payment_id: paymentId,
      order_id: orderId,
      admin_id: isValidUUID(adminId) ? adminId : null,
      admin_email: adminEmail || null,
      action,
      previous_payment_status: previousStatus,
      provider_status_observed: providerStatusObserved,
      resulting_payment_status: resultingStatus,
      order_status_updated: Boolean(orderStatusUpdated),
      reconciliation_result: reconciliationResult,
      details: details || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[recordReconciliationAudit]: Could not write audit row:", err.message);
  }
}
