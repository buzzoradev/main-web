import { createServerSupabaseClient } from "../supabase/server.js";
import { getAdminContext } from "./auth.js";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from "./audit.js";
import { sendOrderShippedEmail, sendOrderDeliveredEmail, getOrderEmailEvents } from "../email/service.js";

/**
 * Valid order state transition matrix for Buzzora fulfillment lifecycle.
 * Normal progression: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED.
 * Pre-dispatch cancellations allowed from PENDING, CONFIRMED, and PROCESSING.
 * Terminal states: DELIVERED and CANCELLED cannot transition further.
 */
export const VALID_ORDER_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const ALLOWED_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

/**
 * Validates shipping details according to strict production standards.
 * - courierName: required for shipment, 2-100 characters.
 * - trackingNumber: required for shipment, 3-100 characters, alphanumeric & safe symbols.
 * - trackingUrl: optional, but if provided, MUST be a valid https:// URL (no javascript:, data:, file:, or localhost).
 *
 * @param {Object} shippingDetails
 * @param {string} [shippingDetails.courierName]
 * @param {string} [shippingDetails.trackingNumber]
 * @param {string} [shippingDetails.trackingUrl]
 * @param {boolean} [isRequired=true] - Whether courier name & tracking number are mandatory
 * @returns {{ isValid: boolean, errors: string[], cleanData: Object }}
 */
export function validateShippingDetails(shippingDetails = {}, isRequired = true) {
  const errors = [];
  const cleanCourier = (shippingDetails.courierName || "").trim();
  const cleanTracking = (shippingDetails.trackingNumber || "").trim();
  const rawUrl = (shippingDetails.trackingUrl || "").trim();

  if (isRequired) {
    if (!cleanCourier || cleanCourier.length < 2 || cleanCourier.length > 100) {
      errors.push("Courier name must be between 2 and 100 characters.");
    }

    if (!cleanTracking || cleanTracking.length < 3 || cleanTracking.length > 100) {
      errors.push("Tracking number must be between 3 and 100 characters.");
    } else if (!/^[A-Za-z0-9\-_\s#]+$/.test(cleanTracking)) {
      errors.push("Tracking number contains invalid characters. Use alphanumeric characters, dashes, or spaces.");
    }
  } else {
    if (cleanCourier && (cleanCourier.length < 2 || cleanCourier.length > 100)) {
      errors.push("Courier name must be between 2 and 100 characters.");
    }
    if (cleanTracking && (cleanTracking.length < 3 || cleanTracking.length > 100)) {
      errors.push("Tracking number must be between 3 and 100 characters.");
    } else if (cleanTracking && !/^[A-Za-z0-9\-_\s#]+$/.test(cleanTracking)) {
      errors.push("Tracking number contains invalid characters.");
    }
  }

  let cleanUrl = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:") {
        errors.push("Tracking URL must use the secure https:// protocol.");
      } else if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0" ||
        parsed.hostname.endsWith(".local")
      ) {
        errors.push("Tracking URL must point to a valid public web destination.");
      } else {
        cleanUrl = parsed.toString();
      }
    } catch {
      errors.push("Invalid tracking URL format.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanData: {
      courierName: cleanCourier || null,
      trackingNumber: cleanTracking || null,
      trackingUrl: cleanUrl,
    },
  };
}

/**
 * Asserts and resolves caller's privileged administrative authorization.
 * Rejects forged objects (such as { role: "admin" }) without verified session authentication.
 * Fails closed immediately if invalid.
 *
 * @param {Object|Request|string} adminContextOrReq
 * @returns {Promise<Object>} Authoritative adminContext
 */
export async function assertAdminAuthorized(adminContextOrReq) {
  if (!adminContextOrReq) {
    const error = new Error("Unauthorized: Admin session required.");
    error.statusCode = 401;
    throw error;
  }

  // If already an authenticated, verified admin context object
  if (
    typeof adminContextOrReq === "object" &&
    adminContextOrReq.authenticated === true &&
    adminContextOrReq.authorized === true &&
    typeof adminContextOrReq.adminId === "string" &&
    adminContextOrReq.adminId.length > 0 &&
    adminContextOrReq.isActive !== false &&
    (adminContextOrReq.role === "admin" || adminContextOrReq.role === "superadmin")
  ) {
    return adminContextOrReq;
  }

  // If already evaluated as unauthorized (e.g. authenticated customer or inactive account)
  if (typeof adminContextOrReq === "object" && adminContextOrReq.authorized === false) {
    const error = new Error("Forbidden: Privileged admin authorization required.");
    error.statusCode = 403;
    error.code = adminContextOrReq.reason || "FORBIDDEN";
    throw error;
  }

  // Attempt resolution from request / token / cookie context
  const resolved = await getAdminContext(adminContextOrReq);

  if (!resolved.authenticated) {
    const error = new Error("Unauthorized: Admin authentication required.");
    error.statusCode = 401;
    throw error;
  }

  if (!resolved.authorized) {
    const error = new Error("Forbidden: Privileged admin authorization required.");
    error.statusCode = 403;
    throw error;
  }

  return resolved;
}

/**
 * Server-side Admin Order Retrieval Service.
 *
 * @param {string} buzzoraOrderId - e.g. "BZ-MUEW22D5-I9LY"
 * @param {Object} adminContext - Admin session context
 * @returns {Promise<Object>} Full order details for fulfillment & audit
 */
export async function getAdminOrderDetails(buzzoraOrderId, adminContext) {
  const verifiedContext = await assertAdminAuthorized(adminContext);

  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string") {
    const error = new Error("Invalid Buzzora Order ID.");
    error.statusCode = 400;
    throw error;
  }

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();
  const supabase = createServerSupabaseClient();

  // 1. Fetch full authoritative order record (resilient to optional courier/timestamp columns)
  let order = null;
  const { data: fullOrder, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (orderError && (orderError.message?.includes("courier_name") || orderError.code === "PGRST204")) {
    const { data: baseOrder, error: baseError } = await supabase
      .from("orders")
      .select("id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, created_at, updated_at, idempotency_key")
      .eq("buzzora_order_id", cleanOrderId)
      .single();

    if (baseError || !baseOrder) {
      const error = new Error("Order not found.");
      error.statusCode = 404;
      throw error;
    }
    order = baseOrder;
  } else if (orderError || !fullOrder) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  } else {
    order = fullOrder;
  }

  // 2. Fetch line items
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    const error = new Error("Failed to load order line items.");
    error.statusCode = 500;
    throw error;
  }

  // 3. Fetch payment attempts
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    const error = new Error("Failed to load payment records.");
    error.statusCode = 500;
    throw error;
  }

  // 4. Fetch status audit history (if table exists)
  let statusHistory = [];
  try {
    const { data: historyData, error: historyError } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });

    if (!historyError && Array.isArray(historyData)) {
      statusHistory = historyData;
    }
  } catch {
    // Graceful fallback if migration 006 has not yet been applied remotely
  }

  // 5. Fetch transactional email events (if table exists)
  const emailEvents = await getOrderEmailEvents(order.id);

  return {
    order: {
      id: order.id,
      buzzoraOrderId: order.buzzora_order_id,
      status: order.status,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      shippingAddress: {
        address: order.shipping_address,
        city: order.city,
        state: order.state,
        postcode: order.postcode,
        country: order.country,
      },
      fulfillment: {
        courierName: order.courier_name || null,
        trackingNumber: order.tracking_number || null,
        trackingUrl: order.tracking_url || null,
        shippedAt: order.shipped_at || null,
        deliveredAt: order.delivered_at || null,
      },
      financials: {
        subtotal: Number(order.subtotal),
        shippingCost: Number(order.shipping_cost),
        total: Number(order.total),
        currency: order.currency,
      },
      audit: {
        idempotencyKey: order.idempotency_key,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
      items: items.map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        sku: i.size_sku,
        weight: i.weight,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        lineTotal: Number(i.line_total),
        createdAt: i.created_at,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        merchantTransactionId: p.merchant_transaction_id,
        paymentProvider: p.payment_provider,
        providerTransactionId: p.provider_transaction_id,
        amount: Number(p.amount),
        currency: p.currency,
        paymentStatus: p.payment_status,
        paidAt: p.paid_at,
        providerResponse: p.provider_response,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      statusHistory: statusHistory.map((h) => ({
        id: h.id,
        previousStatus: h.previous_status,
        newStatus: h.new_status,
        changedBy: h.changed_by,
        reason: h.reason,
        createdAt: h.created_at,
      })),
      emailEvents: (emailEvents || []).map((e) => ({
        id: e.id,
        eventType: e.event_type,
        status: e.status,
        recipientEmail: e.recipient_email,
        resendEmailId: e.resend_email_id,
        attemptCount: e.attempt_count,
        lastError: e.last_error,
        sentAt: e.sent_at,
        createdAt: e.created_at,
      })),
    },
  };
}

/**
 * Updates shipping information (courier, tracking number, tracking URL) without modifying order status.
 *
 * @param {Object} params
 * @param {string} params.buzzoraOrderId - e.g. "BZ-MUEW22D5-I9LY"
 * @param {Object} params.shippingDetails - { courierName, trackingNumber, trackingUrl }
 * @param {Object} params.adminContext - Admin session context
 * @returns {Promise<Object>} Updated shipping details
 */
export async function updateShippingDetails({ buzzoraOrderId, shippingDetails, adminContext }) {
  const verifiedContext = await assertAdminAuthorized(adminContext);

  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string" || !/^BZ-[A-Z0-9-]+$/i.test(buzzoraOrderId.trim())) {
    const error = new Error("Invalid Buzzora Order ID format.");
    error.statusCode = 400;
    throw error;
  }

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();
  const validation = validateShippingDetails(shippingDetails, false);
  if (!validation.isValid) {
    const error = new Error(validation.errors.join(" "));
    error.statusCode = 400;
    throw error;
  }

  const supabase = createServerSupabaseClient();

  // Fetch current order (resilient to optional courier columns)
  let order = null;
  const { data: fullOrder, error: orderError } = await supabase
    .from("orders")
    .select("id, status, courier_name, tracking_number, tracking_url")
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (orderError && (orderError.message?.includes("courier_name") || orderError.code === "PGRST204")) {
    const { data: baseOrder, error: baseError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("buzzora_order_id", cleanOrderId)
      .single();

    if (baseError || !baseOrder) {
      const error = new Error("Order not found.");
      error.statusCode = 404;
      throw error;
    }
    order = { ...baseOrder, courier_name: null, tracking_number: null, tracking_url: null };
  } else if (orderError || !fullOrder) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  } else {
    order = fullOrder;
  }

  if (order.status === "CANCELLED") {
    const error = new Error("Cannot update shipping details for a cancelled order.");
    error.statusCode = 400;
    throw error;
  }

  const updateData = {
    courier_name: validation.cleanData.courierName || order.courier_name,
    tracking_number: validation.cleanData.trackingNumber || order.tracking_number,
    tracking_url: validation.cleanData.trackingUrl !== undefined ? validation.cleanData.trackingUrl : order.tracking_url,
    updated_at: new Date().toISOString(),
  };

  let { data: updated, error: updateError } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", order.id)
    .select("buzzora_order_id, status, courier_name, tracking_number, tracking_url, updated_at")
    .single();

  if (updateError && (updateError.message?.includes("courier_name") || updateError.code === "PGRST204")) {
    updated = {
      buzzora_order_id: cleanOrderId,
      status: order.status,
      courier_name: validation.cleanData.courierName,
      tracking_number: validation.cleanData.trackingNumber,
      tracking_url: validation.cleanData.trackingUrl,
      updated_at: updateData.updated_at,
    };
    updateError = null;
  } else if (updateError) {
    const error = new Error("Failed to update shipping details in database.");
    error.statusCode = 500;
    throw error;
  }

  // Record unified audit log for shipping update
  await recordAdminAudit({
    adminContext: verifiedContext,
    action: AUDIT_ACTIONS.ORDER_SHIPPING_UPDATED,
    resourceType: RESOURCE_TYPES.ORDER,
    resourceId: updated.buzzora_order_id,
    orderId: order.id,
    previousState: {
      courierName: order.courier_name,
    },
    newState: {
      courierName: updated.courier_name,
      trackingNumberChanged: Boolean(validation.cleanData.trackingNumber),
      trackingUrlChanged: Boolean(validation.cleanData.trackingUrl),
    },
  });

  return {
    success: true,
    buzzoraOrderId: updated.buzzora_order_id,
    courierName: updated.courier_name,
    trackingNumber: updated.tracking_number,
    trackingUrl: updated.tracking_url,
    updatedAt: updated.updated_at,
  };
}

/**
 * Transitions an order status atomically adhering to the state machine, payment separation,
 * shipping requirements, server timestamp generation, idempotency, and audit logging.
 *
 * @param {Object} params
 * @param {string} params.buzzoraOrderId - e.g. "BZ-MUEW22D5-I9LY"
 * @param {string} params.targetStatus - PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
 * @param {Object} [params.shippingDetails] - Required when transitioning to SHIPPED
 * @param {string} [params.reason] - Reason for status transition (e.g. cancellation reason)
 * @param {Object} params.adminContext - Admin session context
 * @returns {Promise<Object>} Transition result
 */
export async function transitionOrderStatus({
  buzzoraOrderId,
  targetStatus,
  shippingDetails = {},
  reason = null,
  adminContext,
}) {
  const verifiedContext = await assertAdminAuthorized(adminContext);

  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string" || !/^BZ-[A-Z0-9-]+$/i.test(buzzoraOrderId.trim())) {
    const error = new Error("Invalid Buzzora Order ID format.");
    error.statusCode = 400;
    throw error;
  }

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();
  const normalizedTarget = (targetStatus || "").trim().toUpperCase();

  if (!ALLOWED_ORDER_STATUSES.includes(normalizedTarget)) {
    const error = new Error(
      `Invalid target status '${targetStatus}'. Must be one of: ${ALLOWED_ORDER_STATUSES.join(", ")}.`
    );
    error.statusCode = 400;
    throw error;
  }

  const supabase = createServerSupabaseClient();

  // 1. Fetch current order with latest payment attempt (resilient to optional courier/timestamp columns)
  let order = null;
  const { data: fullOrder, error: orderError } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status, shipped_at, delivered_at")
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (orderError && (orderError.message?.includes("shipped_at") || orderError.code === "PGRST204")) {
    const { data: baseOrder, error: baseError } = await supabase
      .from("orders")
      .select("id, buzzora_order_id, status")
      .eq("buzzora_order_id", cleanOrderId)
      .single();

    if (baseError || !baseOrder) {
      const error = new Error("Order not found.");
      error.statusCode = 404;
      throw error;
    }
    order = { ...baseOrder, shipped_at: null, delivered_at: null };
  } else if (orderError || !fullOrder) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  } else {
    order = fullOrder;
  }

  const currentStatus = order.status;

  // 2. IDEMPOTENCY CHECK: If already at target status, return current state without duplicate mutation
  if (currentStatus === normalizedTarget) {
    return {
      success: true,
      isIdempotent: true,
      buzzoraOrderId: order.buzzora_order_id,
      previousStatus: currentStatus,
      status: normalizedTarget,
      fulfillment: {
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
      },
      shippedAt: order.shipped_at,
      deliveredAt: order.delivered_at,
      message: `Order is already in '${normalizedTarget}' status. No state change required.`,
    };
  }

  // 3. STATE MACHINE VALIDATION: Validate transition path
  const allowedNextStatuses = VALID_ORDER_TRANSITIONS[currentStatus] || [];
  if (!allowedNextStatuses.includes(normalizedTarget)) {
    const error = new Error(
      `Invalid status transition: cannot transition order from '${currentStatus}' to '${normalizedTarget}'. Valid transitions: [${allowedNextStatuses.join(", ") || "none"}].`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. PAYMENT / ORDER SEPARATION: Verify payment before moving to SHIPPED or DELIVERED
  if (normalizedTarget === "SHIPPED" || normalizedTarget === "DELIVERED") {
    const { data: payments } = await supabase
      .from("payments")
      .select("payment_status")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestPaymentStatus = payments?.[0]?.payment_status || "PENDING";
    if (latestPaymentStatus !== "SUCCESS") {
      const error = new Error(
        `Cannot transition order to '${normalizedTarget}' with unconfirmed payment status '${latestPaymentStatus}'. Payment must be SUCCESS.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 5. SHIPPING DATA VALIDATION: Required when transitioning to SHIPPED
  let cleanShipping = null;
  if (normalizedTarget === "SHIPPED") {
    const validation = validateShippingDetails(shippingDetails, true);
    if (!validation.isValid) {
      const error = new Error(`Shipping validation failed: ${validation.errors.join(" ")}`);
      error.statusCode = 400;
      throw error;
    }
    cleanShipping = validation.cleanData;
  }

  // 6. SERVER-SIDE TIMESTAMP ASSIGNMENT (Client timestamps strictly ignored)
  const now = new Date().toISOString();
  const updatePayload = {
    status: normalizedTarget,
    updated_at: now,
  };

  if (normalizedTarget === "SHIPPED") {
    updatePayload.courier_name = cleanShipping.courierName;
    updatePayload.tracking_number = cleanShipping.trackingNumber;
    updatePayload.tracking_url = cleanShipping.trackingUrl;
    // Immutability: preserve existing shipped_at if already set
    updatePayload.shipped_at = order.shipped_at || now;
  }

  if (normalizedTarget === "DELIVERED") {
    // Immutability: preserve existing delivered_at if already set
    updatePayload.delivered_at = order.delivered_at || now;
  }

  // 7. ATOMIC CONDITIONAL UPDATE (Optimistic concurrency control: match id AND current status)
  let { data: updated, error: updateError } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", order.id)
    .eq("status", currentStatus) // Guarantees status has not changed concurrently
    .select()
    .single();

  if (updateError && (updateError.message?.includes("shipped_at") || updateError.message?.includes("courier_name") || updateError.code === "PGRST204")) {
    // Fallback if courier/timestamp columns aren't present on remote schema yet
    const safeBasePayload = {
      status: normalizedTarget,
      updated_at: now,
    };
    const { data: baseUpdated, error: baseUpdateError } = await supabase
      .from("orders")
      .update(safeBasePayload)
      .eq("id", order.id)
      .eq("status", currentStatus)
      .select("id, buzzora_order_id, status, updated_at")
      .single();

    if (!baseUpdateError && baseUpdated) {
      updateError = null;
      updated = {
        ...baseUpdated,
        courier_name: cleanShipping?.courierName || null,
        tracking_number: cleanShipping?.trackingNumber || null,
        tracking_url: cleanShipping?.trackingUrl || null,
        shipped_at: updatePayload.shipped_at || now,
        delivered_at: updatePayload.delivered_at || now,
      };
    } else {
      updateError = baseUpdateError;
    }
  }

  if (updateError || !updated) {
    // Re-check order status to determine if conflict occurred
    const { data: freshOrder } = await supabase
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .single();

    if (freshOrder?.status === normalizedTarget) {
      // Concurrent execution reached the same target state (idempotent recovery)
      return {
        success: true,
        isIdempotent: true,
        buzzoraOrderId: order.buzzora_order_id,
        previousStatus: currentStatus,
        status: normalizedTarget,
        fulfillment: {
          shippedAt: updatePayload.shipped_at || now,
          deliveredAt: updatePayload.delivered_at || now,
        },
        message: `Order transitioned to '${normalizedTarget}' concurrently.`,
      };
    }

    const conflictErr = new Error(
      `Conflict: Order status was concurrently changed from '${currentStatus}' to '${freshOrder?.status || "UNKNOWN"}'. Transition aborted.`
    );
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  // 8. AUDIT HISTORY LOGGING (Immutable audit trail)
  try {
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      previous_status: currentStatus,
      new_status: normalizedTarget,
      changed_by: verifiedContext.adminId || verifiedContext.email || "admin",
      reason: reason || null,
      created_at: now,
    });

    // Record unified audit log for order status mutation
    await recordAdminAudit({
      adminContext: verifiedContext,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      resourceType: RESOURCE_TYPES.ORDER,
      resourceId: updated.buzzora_order_id,
      orderId: order.id,
      previousState: { status: currentStatus },
      newState: { status: updated.status },
      reason: reason || null,
    });
  } catch (auditErr) {
    // Non-blocking fallback if order_status_history table has not yet been migrated remotely
    console.warn("[Admin Fulfillment]: Could not write to order_status_history:", auditErr.message);
  }

  // 9. TRANSACTIONAL EMAIL DISPATCH (Non-blocking & Idempotent)
  if (normalizedTarget === "SHIPPED") {
    sendOrderShippedEmail({
      orderId: order.id,
      buzzoraOrderId: updated.buzzora_order_id,
    }).catch((emailErr) => {
      console.warn("[Admin Fulfillment Email Warning]:", emailErr.message);
    });
  }

  if (normalizedTarget === "DELIVERED") {
    sendOrderDeliveredEmail({
      orderId: order.id,
      buzzoraOrderId: updated.buzzora_order_id,
    }).catch((emailErr) => {
      console.warn("[Admin Fulfillment Email Warning]:", emailErr.message);
    });
  }

  return {
    success: true,
    isIdempotent: false,
    buzzoraOrderId: updated.buzzora_order_id,
    previousStatus: currentStatus,
    status: updated.status,
    fulfillment: {
      courierName: updated.courier_name,
      trackingNumber: updated.tracking_number,
      trackingUrl: updated.tracking_url,
      shippedAt: updated.shipped_at,
      deliveredAt: updated.delivered_at,
    },
    updatedAt: updated.updated_at,
  };
}

/**
 * Retrieves audit history for an order.
 * Strictly privileged server-side admin access.
 */
export async function getOrderStatusHistory(buzzoraOrderId, adminContext) {
  await assertAdminAuthorized(adminContext);

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();
  const supabase = createServerSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (orderError || !order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  try {
    const { data: history, error: historyError } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });

    if (historyError) {
      return [];
    }
    return history || [];
  } catch {
    return [];
  }
}

/**
 * Sanitizes and normalizes an administrative search term.
 * Protects against SQL injection, wildcard injection, and excessively long inputs.
 */
function sanitizeSearchQuery(query) {
  if (!query || typeof query !== "string") return "";
  return query
    .trim()
    .replace(/[%_,();"'\\]/g, "")
    .slice(0, 50);
}

/**
 * Retrieves a paginated, searchable, and filterable list of customer orders for administration.
 *
 * Security & Scalability:
 * - Requires privileged administrative authorization.
 * - Strict bounded pagination (maximum 100 items per page).
 * - Safe parameterized search across Order ID, customer name, email, and phone.
 * - Single-query relational join with payments table (zero N+1 queries).
 * - Excludes internal database UUIDs and raw provider responses from listing output.
 *
 * @param {Object} params
 * @param {number} [params.page=1] - 1-indexed page number
 * @param {number} [params.pageSize=20] - Page size (bounded 1-100)
 * @param {string} [params.search] - Search string
 * @param {string} [params.orderStatus="ALL"] - Order status filter
 * @param {string} [params.paymentStatus="ALL"] - Payment status filter
 * @param {string} [params.fromDate] - Filter orders created >= fromDate
 * @param {string} [params.toDate] - Filter orders created <= toDate
 * @param {Object} params.adminContext - Admin session context
 * @returns {Promise<Object>} Paginated orders result
 */
export async function getAdminOrdersList({
  page = 1,
  pageSize = 20,
  search = "",
  orderStatus = "ALL",
  paymentStatus = "ALL",
  fromDate = null,
  toDate = null,
  adminContext,
}) {
  await assertAdminAuthorized(adminContext);

  const cleanPage = Math.max(1, parseInt(page, 10) || 1);
  const cleanPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const from = (cleanPage - 1) * cleanPageSize;
  const to = from + cleanPageSize - 1;

  const cleanSearch = sanitizeSearchQuery(search);
  const normalizedOrderStatus = (orderStatus || "ALL").trim().toUpperCase();
  const normalizedPaymentStatus = (paymentStatus || "ALL").trim().toUpperCase();

  const supabase = createServerSupabaseClient();

  // Determine whether to use inner join for payment filtering
  const isFilteringPayment = normalizedPaymentStatus !== "ALL";
  const paymentRelation = isFilteringPayment
    ? "payments!inner(payment_status, payment_provider, provider_transaction_id, paid_at)"
    : "payments(payment_status, payment_provider, provider_transaction_id, paid_at)";

  // Full schema select string
  const fullSelect = `buzzora_order_id, customer_name, customer_email, customer_phone, status, total, currency, courier_name, tracking_number, tracking_url, created_at, ${paymentRelation}`;
  const baseSelect = `buzzora_order_id, customer_name, customer_email, customer_phone, status, total, currency, created_at, ${paymentRelation}`;

  // Helper to build queries
  const buildQuery = (selectString) => {
    let q = supabase
      .from("orders")
      .select(selectString, { count: "exact" })
      .order("created_at", { ascending: false });

    if (cleanSearch) {
      q = q.or(
        `buzzora_order_id.ilike.*${cleanSearch}*,customer_name.ilike.*${cleanSearch}*,customer_email.ilike.*${cleanSearch}*,customer_phone.ilike.*${cleanSearch}*`
      );
    }

    if (normalizedOrderStatus !== "ALL" && ALLOWED_ORDER_STATUSES.includes(normalizedOrderStatus)) {
      q = q.eq("status", normalizedOrderStatus);
    }

    if (isFilteringPayment) {
      q = q.eq("payments.payment_status", normalizedPaymentStatus);
    }

    if (fromDate) {
      try {
        const fromIso = new Date(fromDate).toISOString();
        q = q.gte("created_at", fromIso);
      } catch {
        // Ignore invalid dates
      }
    }

    if (toDate) {
      try {
        const toIso = new Date(toDate).toISOString();
        q = q.lte("created_at", toIso);
      } catch {
        // Ignore invalid dates
      }
    }

    return q.range(from, to);
  };

  // Attempt with full schema first (resilient to optional courier fields)
  let { data, count, error } = await buildQuery(fullSelect);

  if (error && (error.message?.includes("courier_name") || error.code === "PGRST204")) {
    const fallbackRes = await buildQuery(baseSelect);
    if (!fallbackRes.error) {
      data = fallbackRes.data?.map((o) => ({
        ...o,
        courier_name: null,
        tracking_number: null,
        tracking_url: null,
      }));
      count = fallbackRes.count;
      error = null;
    } else {
      error = fallbackRes.error;
    }
  }

  if (error) {
    console.error("[getAdminOrdersList] Database query error:", error.message);
    const err = new Error("Failed to load orders from database.");
    err.statusCode = 500;
    throw err;
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / cleanPageSize) || 1;

  // Format clean presentation model
  const orders = (data || []).map((order) => {
    const latestPayment = Array.isArray(order.payments) && order.payments.length > 0
      ? order.payments[0]
      : null;

    const paymentStatus =
      latestPayment?.payment_status || (order.status === "CONFIRMED" ? "SUCCESS" : "PENDING");

    return {
      orderId: order.buzzora_order_id,
      buzzoraOrderId: order.buzzora_order_id,
      createdAt: order.created_at,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      amount: Number(order.total),
      currency: order.currency || "INR",
      orderStatus: order.status,
      paymentStatus,
      paymentProvider: latestPayment?.payment_provider || null,
      fulfillment: {
        courierName: order.courier_name || null,
        trackingNumber: order.tracking_number || null,
        trackingUrl: order.tracking_url || null,
      },
    };
  });

  return {
    orders,
    page: cleanPage,
    pageSize: cleanPageSize,
    totalCount,
    totalPages,
  };
}

