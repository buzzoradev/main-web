import { createServerSupabaseClient } from "../supabase/server.js";
import { requireAdmin } from "./auth.js";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_RESULTS, isValidUUID } from "./audit.js";
import { normalizeCouponCode } from "../coupons.js";

/**
 * Validates administrative coupon input payloads.
 *
 * @param {Object} payload
 * @param {boolean} [isUpdate=false]
 * @returns {{ isValid: boolean, error?: string, normalized?: Object }}
 */
export function validateAdminCouponPayload(payload, isUpdate = false) {
  if (!payload || typeof payload !== "object") {
    return { isValid: false, error: "Invalid coupon payload." };
  }

  const {
    code,
    discountPercent,
    discount_percent,
    minimumOrderAmount,
    minimum_order_amount,
    maximumDiscountAmount,
    maximum_discount_amount,
    startsAt,
    starts_at,
    expiresAt,
    expires_at,
    usageLimit,
    usage_limit,
    isActive,
    is_active,
  } = payload;

  const normalized = {};

  // 1. Code Validation
  if (!isUpdate || code !== undefined) {
    const cleanCode = normalizeCouponCode(code);
    if (!cleanCode) {
      return { isValid: false, error: "Coupon code is required and must not be empty." };
    }
    if (cleanCode.length < 2 || cleanCode.length > 50) {
      return { isValid: false, error: "Coupon code must be between 2 and 50 characters." };
    }
    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      return { isValid: false, error: "Coupon code can only contain letters, numbers, hyphens, and underscores." };
    }
    normalized.code = cleanCode;
  }

  // 2. Discount Percent Validation (0 < discount_percent <= 100)
  const rawDiscount = discountPercent !== undefined ? discountPercent : discount_percent;
  if (!isUpdate || rawDiscount !== undefined) {
    const numDiscount = Number(rawDiscount);
    if (!Number.isFinite(numDiscount) || numDiscount <= 0 || numDiscount > 100) {
      return { isValid: false, error: "Discount percentage must be greater than 0% and at most 100%." };
    }
    normalized.discount_percent = Math.round(numDiscount * 100) / 100;
  }

  // 3. Minimum Order Amount (>= 0)
  const rawMinOrder = minimumOrderAmount !== undefined ? minimumOrderAmount : minimum_order_amount;
  if (rawMinOrder !== undefined && rawMinOrder !== null && rawMinOrder !== "") {
    const numMin = Number(rawMinOrder);
    if (!Number.isFinite(numMin) || numMin < 0) {
      return { isValid: false, error: "Minimum order amount cannot be negative." };
    }
    normalized.minimum_order_amount = Math.round(numMin * 100) / 100;
  } else if (!isUpdate) {
    normalized.minimum_order_amount = 0;
  }

  // 4. Maximum Discount Amount (IS NULL OR >= 0)
  const rawMaxDiscount = maximumDiscountAmount !== undefined ? maximumDiscountAmount : maximum_discount_amount;
  if (rawMaxDiscount !== undefined) {
    if (rawMaxDiscount === null || rawMaxDiscount === "") {
      normalized.maximum_discount_amount = null;
    } else {
      const numMax = Number(rawMaxDiscount);
      if (!Number.isFinite(numMax) || numMax < 0) {
        return { isValid: false, error: "Maximum discount amount cannot be negative." };
      }
      normalized.maximum_discount_amount = Math.round(numMax * 100) / 100;
    }
  }

  // 5. Usage Limit (IS NULL OR > 0 integer)
  const rawUsageLimit = usageLimit !== undefined ? usageLimit : usage_limit;
  if (rawUsageLimit !== undefined) {
    if (rawUsageLimit === null || rawUsageLimit === "") {
      normalized.usage_limit = null;
    } else {
      const numLimit = Number(rawUsageLimit);
      if (!Number.isInteger(numLimit) || numLimit <= 0) {
        return { isValid: false, error: "Usage limit must be a positive whole number greater than 0." };
      }
      normalized.usage_limit = numLimit;
    }
  }

  // 6. Dates: starts_at and expires_at
  const rawStartsAt = startsAt !== undefined ? startsAt : starts_at;
  if (rawStartsAt !== undefined) {
    if (rawStartsAt === null || rawStartsAt === "") {
      normalized.starts_at = null;
    } else {
      const startDate = new Date(rawStartsAt);
      if (isNaN(startDate.getTime())) {
        return { isValid: false, error: "Invalid start date format." };
      }
      normalized.starts_at = startDate.toISOString();
    }
  }

  const rawExpiresAt = expiresAt !== undefined ? expiresAt : expires_at;
  if (rawExpiresAt !== undefined) {
    if (rawExpiresAt === null || rawExpiresAt === "") {
      normalized.expires_at = null;
    } else {
      const expireDate = new Date(rawExpiresAt);
      if (isNaN(expireDate.getTime())) {
        return { isValid: false, error: "Invalid expiry date format." };
      }
      normalized.expires_at = expireDate.toISOString();
    }
  }

  // Verify starts_at < expires_at if both are set
  const finalStart = normalized.starts_at;
  const finalExpire = normalized.expires_at;
  if (finalStart && finalExpire) {
    if (new Date(finalExpire).getTime() <= new Date(finalStart).getTime()) {
      return { isValid: false, error: "Expiry date must be after the start date." };
    }
  }

  // 7. Active Status
  const rawActive = isActive !== undefined ? isActive : is_active;
  if (rawActive !== undefined) {
    normalized.is_active = Boolean(rawActive);
  } else if (!isUpdate) {
    normalized.is_active = true;
  }

  return { isValid: true, normalized };
}

/**
 * Retrieves a paginated and filterable list of coupons for the admin console.
 */
export async function getAdminCoupons({
  page = 1,
  pageSize = 25,
  search = "",
  status = "ALL",
  adminContext,
}) {
  const verifiedAdmin = await requireAdmin(adminContext);
  const cleanPage = Math.max(1, parseInt(page, 10) || 1);
  const cleanPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const from = (cleanPage - 1) * cleanPageSize;
  const to = from + cleanPageSize - 1;

  const supabase = createServerSupabaseClient();

  try {
    let query = supabase
      .from("coupons")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Filter by search query
    const cleanSearch = (search || "").trim();
    if (cleanSearch) {
      query = query.ilike("code", `%${cleanSearch}%`);
    }

    // Filter by status: ALL, ACTIVE, INACTIVE, EXPIRED
    const normalizedStatus = (status || "ALL").trim().toUpperCase();
    const nowIso = new Date().toISOString();

    if (normalizedStatus === "ACTIVE") {
      query = query
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    } else if (normalizedStatus === "INACTIVE") {
      query = query.eq("is_active", false);
    } else if (normalizedStatus === "EXPIRED") {
      query = query.not("expires_at", "is", null).lte("expires_at", nowIso);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
      // Graceful fallback if table not yet in schema cache
      if (error.code === "PGRST205" || error.message?.includes("coupons")) {
        return {
          coupons: [],
          pagination: {
            page: cleanPage,
            pageSize: cleanPageSize,
            totalCount: 0,
            totalPages: 1,
          },
        };
      }
      console.error("[getAdminCoupons] Database error:", error.message);
      const err = new Error("Failed to load coupons from database.");
      err.statusCode = 500;
      throw err;
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / cleanPageSize) || 1;

    const coupons = (data || []).map((c) => ({
      id: c.id,
      code: c.code,
      discountPercent: Number(c.discount_percent),
      isActive: Boolean(c.is_active),
      minimumOrderAmount: Number(c.minimum_order_amount || 0),
      maximumDiscountAmount: c.maximum_discount_amount != null ? Number(c.maximum_discount_amount) : null,
      startsAt: c.starts_at,
      expiresAt: c.expires_at,
      usageLimit: c.usage_limit,
      usageCount: Number(c.usage_count || 0),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return {
      coupons,
      pagination: {
        page: cleanPage,
        pageSize: cleanPageSize,
        totalCount,
        totalPages,
      },
    };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error("[getAdminCoupons] Exception:", err.message);
    const error = new Error("Failed to retrieve coupons.");
    error.statusCode = 500;
    throw error;
  }
}

/**
 * Retrieves a single coupon by ID with usage statistics.
 */
export async function getAdminCouponById(id, adminContext) {
  await requireAdmin(adminContext);

  if (!isValidUUID(id)) {
    const error = new Error("Invalid coupon ID format.");
    error.statusCode = 400;
    throw error;
  }

  const supabase = createServerSupabaseClient();
  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !coupon) {
    const err = new Error("Coupon not found.");
    err.statusCode = 404;
    throw err;
  }

  return {
    id: coupon.id,
    code: coupon.code,
    discountPercent: Number(coupon.discount_percent),
    isActive: Boolean(coupon.is_active),
    minimumOrderAmount: Number(coupon.minimum_order_amount || 0),
    maximumDiscountAmount: coupon.maximum_discount_amount != null ? Number(coupon.maximum_discount_amount) : null,
    startsAt: coupon.starts_at,
    expiresAt: coupon.expires_at,
    usageLimit: coupon.usage_limit,
    usageCount: Number(coupon.usage_count || 0),
    createdAt: coupon.created_at,
    updatedAt: coupon.updated_at,
  };
}

/**
 * Creates a new coupon with strict validation, case-insensitive uniqueness, and audit logging.
 */
export async function createAdminCoupon(payload, adminContext) {
  const verifiedAdmin = await requireAdmin(adminContext);

  const validation = validateAdminCouponPayload(payload, false);
  if (!validation.isValid) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  const { normalized } = validation;
  const supabase = createServerSupabaseClient();

  // 1. Check for duplicate code case-insensitively
  const { data: existing } = await supabase
    .from("coupons")
    .select("id, code")
    .ilike("code", normalized.code)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const error = new Error(`A coupon with code "${normalized.code}" already exists.`);
    error.statusCode = 409;
    throw error;
  }

  // 2. Insert new coupon record
  const { data: createdCoupon, error: insertError } = await supabase
    .from("coupons")
    .insert({
      code: normalized.code,
      discount_percent: normalized.discount_percent,
      is_active: normalized.is_active,
      minimum_order_amount: normalized.minimum_order_amount,
      maximum_discount_amount: normalized.maximum_discount_amount,
      starts_at: normalized.starts_at,
      expires_at: normalized.expires_at,
      usage_limit: normalized.usage_limit,
      usage_count: 0,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[createAdminCoupon] Insert error:", insertError.message);
    const error = new Error("Failed to create coupon in database.");
    error.statusCode = 500;
    throw error;
  }

  // 3. Record Audit Log
  await recordAdminAudit({
    adminContext: verifiedAdmin,
    action: AUDIT_ACTIONS.COUPON_CREATED,
    resourceType: RESOURCE_TYPES.COUPON,
    resourceId: createdCoupon.id,
    newState: {
      code: createdCoupon.code,
      discountPercent: createdCoupon.discount_percent,
      isActive: createdCoupon.is_active,
      usageLimit: createdCoupon.usage_limit,
    },
    result: AUDIT_RESULTS.SUCCESS,
    reason: `Created coupon ${createdCoupon.code} (${createdCoupon.discount_percent}%)`,
  });

  return {
    id: createdCoupon.id,
    code: createdCoupon.code,
    discountPercent: Number(createdCoupon.discount_percent),
    isActive: Boolean(createdCoupon.is_active),
    minimumOrderAmount: Number(createdCoupon.minimum_order_amount || 0),
    maximumDiscountAmount: createdCoupon.maximum_discount_amount != null ? Number(createdCoupon.maximum_discount_amount) : null,
    startsAt: createdCoupon.starts_at,
    expiresAt: createdCoupon.expires_at,
    usageLimit: createdCoupon.usage_limit,
    usageCount: Number(createdCoupon.usage_count || 0),
    createdAt: createdCoupon.created_at,
    updatedAt: createdCoupon.updated_at,
  };
}

/**
 * Updates an existing coupon with validation, change auditing, and snapshot preservation.
 */
export async function updateAdminCoupon(id, payload, adminContext) {
  const verifiedAdmin = await requireAdmin(adminContext);

  if (!isValidUUID(id)) {
    const error = new Error("Invalid coupon ID format.");
    error.statusCode = 400;
    throw error;
  }

  const validation = validateAdminCouponPayload(payload, true);
  if (!validation.isValid) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  const { normalized } = validation;
  const supabase = createServerSupabaseClient();

  // 1. Fetch current snapshot
  const { data: current, error: fetchErr } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !current) {
    const error = new Error("Coupon not found.");
    error.statusCode = 404;
    throw error;
  }

  // 2. If code changed, check uniqueness
  if (normalized.code && normalized.code !== current.code) {
    const { data: duplicate } = await supabase
      .from("coupons")
      .select("id")
      .ilike("code", normalized.code)
      .neq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (duplicate) {
      const error = new Error(`A coupon with code "${normalized.code}" already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  // 3. Update coupon record
  const updateData = { ...normalized, updated_at: new Date().toISOString() };
  const { data: updatedCoupon, error: updateError } = await supabase
    .from("coupons")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("[updateAdminCoupon] Update error:", updateError.message);
    const error = new Error("Failed to update coupon in database.");
    error.statusCode = 500;
    throw error;
  }

  // 4. Audit Logging
  let action = AUDIT_ACTIONS.COUPON_UPDATED;
  if (normalized.is_active !== undefined && normalized.is_active !== current.is_active) {
    action = normalized.is_active ? AUDIT_ACTIONS.COUPON_ENABLED : AUDIT_ACTIONS.COUPON_DISABLED;
  }

  await recordAdminAudit({
    adminContext: verifiedAdmin,
    action,
    resourceType: RESOURCE_TYPES.COUPON,
    resourceId: id,
    previousState: {
      code: current.code,
      discountPercent: current.discount_percent,
      isActive: current.is_active,
      usageLimit: current.usage_limit,
    },
    newState: {
      code: updatedCoupon.code,
      discountPercent: updatedCoupon.discount_percent,
      isActive: updatedCoupon.is_active,
      usageLimit: updatedCoupon.usage_limit,
    },
    result: AUDIT_RESULTS.SUCCESS,
    reason: `Updated coupon ${updatedCoupon.code}`,
  });

  return {
    id: updatedCoupon.id,
    code: updatedCoupon.code,
    discountPercent: Number(updatedCoupon.discount_percent),
    isActive: Boolean(updatedCoupon.is_active),
    minimumOrderAmount: Number(updatedCoupon.minimum_order_amount || 0),
    maximumDiscountAmount: updatedCoupon.maximum_discount_amount != null ? Number(updatedCoupon.maximum_discount_amount) : null,
    startsAt: updatedCoupon.starts_at,
    expiresAt: updatedCoupon.expires_at,
    usageLimit: updatedCoupon.usage_limit,
    usageCount: Number(updatedCoupon.usage_count || 0),
    createdAt: updatedCoupon.created_at,
    updatedAt: updatedCoupon.updated_at,
  };
}

/**
 * Safely removes a coupon.
 * If historical orders exist with this coupon, performs a soft-delete / archiving to
 * ensure historical order snapshots remain 100% intact and unaltered.
 */
export async function deleteAdminCoupon(id, adminContext) {
  const verifiedAdmin = await requireAdmin(adminContext);

  if (!isValidUUID(id)) {
    const error = new Error("Invalid coupon ID format.");
    error.statusCode = 400;
    throw error;
  }

  const supabase = createServerSupabaseClient();

  // 1. Fetch current coupon
  const { data: coupon, error: fetchErr } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !coupon) {
    const error = new Error("Coupon not found.");
    error.statusCode = 404;
    throw error;
  }

  // 2. Perform safe soft deletion (sets deleted_at and deactivates)
  // Ensures historical orders retain snapshot details and FK constraints are never broken.
  const { error: deleteErr } = await supabase
    .from("coupons")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (deleteErr) {
    console.error("[deleteAdminCoupon] Delete error:", deleteErr.message);
    const error = new Error("Failed to delete coupon.");
    error.statusCode = 500;
    throw error;
  }

  // 3. Record Audit Log
  await recordAdminAudit({
    adminContext: verifiedAdmin,
    action: AUDIT_ACTIONS.COUPON_DELETED,
    resourceType: RESOURCE_TYPES.COUPON,
    resourceId: id,
    previousState: {
      code: coupon.code,
      discountPercent: coupon.discount_percent,
      isActive: coupon.is_active,
      usageCount: coupon.usage_count,
    },
    result: AUDIT_RESULTS.SUCCESS,
    reason: `Safely archived coupon ${coupon.code}`,
  });

  return { success: true, message: `Coupon "${coupon.code}" has been safely archived.` };
}
