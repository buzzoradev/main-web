import { createServerSupabaseClient } from "../supabase/server.js";
import { assertAdminAuthorized } from "./orders.js";

/**
 * Structured taxonomy of administrative audit actions.
 */
export const AUDIT_ACTIONS = {
  // Authentication & Session Security
  ADMIN_LOGIN_SUCCESS: "ADMIN_LOGIN_SUCCESS",
  ADMIN_LOGIN_FAILURE: "ADMIN_LOGIN_FAILURE",
  ADMIN_LOGOUT: "ADMIN_LOGOUT",
  ADMIN_SESSION_REFRESH: "ADMIN_SESSION_REFRESH",
  ADMIN_SESSION_REVOKED: "ADMIN_SESSION_REVOKED",

  // Order Operations
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  ORDER_SHIPPING_UPDATED: "ORDER_SHIPPING_UPDATED",

  // Payment Operations
  PAYMENT_RECONCILIATION_STARTED: "PAYMENT_RECONCILIATION_STARTED",
  PAYMENT_RECONCILIATION_SUCCEEDED: "PAYMENT_RECONCILIATION_SUCCEEDED",
  PAYMENT_RECONCILIATION_FAILED: "PAYMENT_RECONCILIATION_FAILED",
  PAYMENT_MISMATCH_DETECTED: "PAYMENT_MISMATCH_DETECTED",

  // Admin Management
  ADMIN_USER_CREATED: "ADMIN_USER_CREATED",
  ADMIN_USER_ENABLED: "ADMIN_USER_ENABLED",
  ADMIN_USER_DISABLED: "ADMIN_USER_DISABLED",
  ADMIN_ROLE_CHANGED: "ADMIN_ROLE_CHANGED",

  // Coupon Operations
  COUPON_CREATED: "COUPON_CREATED",
  COUPON_UPDATED: "COUPON_UPDATED",
  COUPON_ENABLED: "COUPON_ENABLED",
  COUPON_DISABLED: "COUPON_DISABLED",
  COUPON_DELETED: "COUPON_DELETED",
  COUPON_APPLIED: "COUPON_APPLIED",
  COUPON_REJECTED: "COUPON_REJECTED",
  COUPON_USAGE_CONSUMED: "COUPON_USAGE_CONSUMED",
};

/**
 * Resource type classifications.
 */
export const RESOURCE_TYPES = {
  SESSION: "session",
  ORDER: "order",
  PAYMENT: "payment",
  ADMIN_USER: "admin_user",
  COUPON: "coupon",
};

/**
 * Audit result classifications.
 */
export const AUDIT_RESULTS = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  CONFLICT: "CONFLICT",
  REJECTED: "REJECTED",
};

/**
 * Validates whether a given string is a valid UUIDv4.
 */
export function isValidUUID(id) {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

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
 * Deeply sanitizes arbitrary data structures before recording into audit logs.
 * Recursively strips passwords, tokens, secrets, credentials, and full auth headers.
 * Truncates excessively long string values to prevent unbounded database bloat.
 *
 * @param {*} data
 * @param {number} [depth=0]
 * @returns {*} Sanitized data structure
 */
export function sanitizeAuditPayload(data, depth = 0) {
  if (depth > 4) return "[TRUNCATED_NESTING]";
  if (data === null || data === undefined) return null;

  if (typeof data === "string") {
    // Truncate long strings to 500 characters
    return data.length > 500 ? data.slice(0, 500) + "...[TRUNCATED]" : data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.slice(0, 20).map((item) => sanitizeAuditPayload(item, depth + 1));
  }

  if (typeof data === "object") {
    const sanitized = {};
    const sensitiveKeyPattern = /password|secret|token|key|auth|cookie|credential|cvv|card/i;

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeyPattern.test(key)) {
        sanitized[key] = "[REDACTED_SECRET]";
      } else {
        sanitized[key] = sanitizeAuditPayload(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(data);
}

/**
 * Centralized, server-authoritative audit logging service.
 *
 * Immutability & Failure Behavior:
 * - Records security-relevant operational actions.
 * - Non-blocking for critical business mutations by default: if audit recording encounters
 *   a transient failure, it logs a warning without reversing a completed customer transaction.
 * - For security-critical assertions where audit failure must fail closed, pass `strictThrow: true`.
 *
 * @param {Object} params
 * @param {Object} [params.adminContext] - Verified admin context { adminId, email, role }
 * @param {string} params.action - One of AUDIT_ACTIONS
 * @param {string} [params.resourceType] - One of RESOURCE_TYPES
 * @param {string} [params.resourceId] - Identifier of the affected resource (Order ID, Payment ID, etc.)
 * @param {string} [params.orderId] - UUID of associated order if applicable
 * @param {string} [params.paymentId] - UUID of associated payment if applicable
 * @param {Object} [params.previousState] - Previous snapshot state
 * @param {Object} [params.newState] - Resulting snapshot state
 * @param {string} [params.result="SUCCESS"] - Operation result
 * @param {string} [params.reason] - Justification or error summary
 * @param {Object} [params.metadata] - Additional contextual telemetry
 * @param {boolean} [params.strictThrow=false] - If true, throws Error on audit failure
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export async function recordAdminAudit({
  adminContext = null,
  action,
  resourceType = null,
  resourceId = null,
  orderId = null,
  paymentId = null,
  previousState = null,
  newState = null,
  result = AUDIT_RESULTS.SUCCESS,
  reason = null,
  metadata = null,
  strictThrow = false,
}) {
  if (!action || typeof action !== "string") {
    console.error("[recordAdminAudit] Missing mandatory audit action.");
    return { success: false, error: "Action is required." };
  }

  const supabase = createServerSupabaseClient();

  const auditRow = {
    admin_user_id: isValidUUID(adminContext?.adminId) ? adminContext.adminId : null,
    admin_email: adminContext?.email ? String(adminContext.email).trim().toLowerCase() : null,
    action: action.trim().toUpperCase(),
    resource_type: resourceType ? String(resourceType).trim().toLowerCase() : null,
    resource_id: resourceId ? String(resourceId).trim() : null,
    order_id: isValidUUID(orderId) ? orderId.trim() : null,
    payment_id: isValidUUID(paymentId) ? paymentId.trim() : null,
    previous_state: previousState ? sanitizeAuditPayload(previousState) : null,
    new_state: newState ? sanitizeAuditPayload(newState) : null,
    result: result ? String(result).trim().toUpperCase() : AUDIT_RESULTS.SUCCESS,
    reason: reason ? String(reason).slice(0, 500) : null,
    metadata: metadata ? sanitizeAuditPayload(metadata) : null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("admin_audit_log")
      .insert(auditRow)
      .select("id")
      .single();

    if (error) {
      console.warn("[recordAdminAudit] DB insert error:", error.message);
      if (strictThrow) {
        throw new Error(`Security Audit Recording Failed: ${error.message}`);
      }
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.warn("[recordAdminAudit] Unexpected error:", err.message);
    if (strictThrow) {
      throw err;
    }
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves a paginated, searchable, and filterable list of audit log entries.
 * Strictly privileged server-side access for authorized administrators.
 *
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=25]
 * @param {string} [params.action="ALL"]
 * @param {string} [params.resourceType="ALL"]
 * @param {string} [params.search=""]
 * @param {string} [params.fromDate]
 * @param {string} [params.toDate]
 * @param {Object} params.adminContext
 * @returns {Promise<Object>} Paginated audit log records
 */
export async function getAdminAuditLogs({
  page = 1,
  pageSize = 25,
  action = "ALL",
  resourceType = "ALL",
  search = "",
  fromDate = null,
  toDate = null,
  adminContext,
}) {
  await assertAdminAuthorized(adminContext);

  const cleanPage = Math.max(1, parseInt(page, 10) || 1);
  const cleanPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const from = (cleanPage - 1) * cleanPageSize;
  const to = from + cleanPageSize - 1;

  const cleanSearch = sanitizeSearchQuery(search);
  const normalizedAction = (action || "ALL").trim().toUpperCase();
  const normalizedResourceType = (resourceType || "ALL").trim().toLowerCase();

  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (normalizedAction !== "ALL" && AUDIT_ACTIONS[normalizedAction]) {
    query = query.eq("action", normalizedAction);
  }

  if (normalizedResourceType !== "ALL") {
    query = query.eq("resource_type", normalizedResourceType);
  }

  if (cleanSearch) {
    query = query.or(
      `admin_email.ilike.*${cleanSearch}*,resource_id.ilike.*${cleanSearch}*,action.ilike.*${cleanSearch}*,reason.ilike.*${cleanSearch}*`
    );
  }

  if (fromDate) {
    try {
      const fromIso = new Date(fromDate).toISOString();
      query = query.gte("created_at", fromIso);
    } catch {
      // Ignore invalid date
    }
  }

  if (toDate) {
    try {
      const toIso = new Date(toDate).toISOString();
      query = query.lte("created_at", toIso);
    } catch {
      // Ignore invalid date
    }
  }

  let data = [];
  let count = 0;
  let error = null;

  try {
    const res = await query.range(from, to);
    data = res.data || [];
    count = res.count || 0;
    error = res.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    // If migration 010 has not been executed remotely yet, return empty list gracefully
    if (error.code === "PGRST205" || error.message?.includes("admin_audit_log")) {
      console.warn("[getAdminAuditLogs] Table admin_audit_log not found in schema cache. Returning empty list.");
      return {
        logs: [],
        pagination: {
          page: cleanPage,
          pageSize: cleanPageSize,
          totalCount: 0,
          totalPages: 1,
        },
      };
    }

    console.error("[getAdminAuditLogs] Database error:", error.message);
    const err = new Error("Failed to load audit logs from database.");
    err.statusCode = 500;
    throw err;
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / cleanPageSize) || 1;

  // Format presentation model
  const logs = data.map((log) => ({
    id: log.id,
    adminUserId: log.admin_user_id,
    adminEmail: log.admin_email || "System / Automated",
    action: log.action,
    resourceType: log.resource_type,
    resourceId: log.resource_id,
    orderId: log.order_id,
    paymentId: log.payment_id,
    previousState: log.previous_state,
    newState: log.new_state,
    result: log.result,
    reason: log.reason,
    metadata: log.metadata,
    createdAt: log.created_at,
  }));

  return {
    logs,
    pagination: {
      page: cleanPage,
      pageSize: cleanPageSize,
      totalCount,
      totalPages,
    },
  };
}
