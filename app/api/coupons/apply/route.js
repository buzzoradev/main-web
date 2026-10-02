import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeCouponCode,
  validateCoupon,
  calculateCouponDiscount,
  reconstructAuthoritativeCart,
} from "@/lib/coupons";
import { couponApplyRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";
import { readBoundedJson } from "@/lib/security/request";

export async function POST(request) {
  // 1. Enforce distributed rate limiting (10 attempts / 5 minutes per IP)
  const rateLimitResult = await couponApplyRateLimit(request);
  if (!rateLimitResult.success) {
    return rateLimitResponse(
      rateLimitResult,
      "Too many coupon code attempts. Please wait a few moments before trying again."
    );
  }

  // 2. Read bounded JSON request body (max 32KB)
  let body;
  try {
    body = await readBoundedJson(request, { maxBytes: 32 * 1024 });
  } catch (err) {
    const status = err.statusCode || 400;
    return NextResponse.json({ valid: false, error: err.message || "Invalid request body." }, { status });
  }

  const { code, items } = body || {};

  // 3. Normalize & validate coupon code input format
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    return NextResponse.json(
      { valid: false, error: "Please enter a valid coupon code." },
      { status: 400 }
    );
  }

  // 4. Reconstruct items, subtotal & shipping strictly from server-authoritative catalog
  const cart = reconstructAuthoritativeCart(items);
  if (!cart.isValid) {
    return NextResponse.json(
      { valid: false, error: cart.error || "Invalid cart items." },
      { status: 400 }
    );
  }

  // 5. Query Supabase for coupon record (case-insensitive lookup, service-role query)
  let coupon = null;
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("coupons")
      .select(
        "id, code, discount_percent, is_active, minimum_order_amount, maximum_discount_amount, starts_at, expires_at, usage_limit, usage_count, deleted_at"
      )
      .ilike("code", normalizedCode)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      // Graceful fallback if table not yet created in remote schema cache
      if (error.code === "PGRST205" || error.message?.includes("coupons")) {
        console.warn("[POST /api/coupons/apply] coupons table missing in schema cache.");
        return NextResponse.json(
          { valid: false, error: "Invalid coupon code." },
          { status: 400 }
        );
      }
      console.error("[POST /api/coupons/apply] Database lookup error:", error.message);
      return NextResponse.json(
        { valid: false, error: "Unable to verify coupon at this time." },
        { status: 500 }
      );
    }

    coupon = data;
  } catch (dbErr) {
    console.error("[POST /api/coupons/apply] Database exception:", dbErr.message);
    return NextResponse.json(
      { valid: false, error: "Unable to verify coupon at this time." },
      { status: 500 }
    );
  }

  // 6. Enforce strict validation rules
  const validation = validateCoupon(coupon, cart.subtotal);
  if (!validation.isValid) {
    return NextResponse.json(
      { valid: false, error: validation.error || "Invalid coupon code." },
      { status: 400 }
    );
  }

  // 7. Calculate server-authoritative discount and final total
  const calculation = calculateCouponDiscount({
    subtotal: cart.subtotal,
    shippingCost: cart.shippingCost,
    discountPercent: Number(coupon.discount_percent),
    maximumDiscountAmount: coupon.maximum_discount_amount ? Number(coupon.maximum_discount_amount) : null,
  });

  // 8. Return sanitized, safe response (no database internals)
  return NextResponse.json({
    valid: true,
    code: coupon.code.toUpperCase(),
    discountPercent: Number(coupon.discount_percent),
    discountAmount: calculation.discountAmount,
    subtotal: cart.subtotal,
    shipping: cart.shippingCost,
    finalTotal: calculation.finalTotal,
  });
}
