import { NextResponse } from "next/server";
import { products } from "@/lib/products";
import { newOrderId } from "@/lib/order";
import { createOrderRecord } from "@/lib/db/orders";
import { generateOrderVerificationToken } from "@/lib/security";
import { orderCreateRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";
import { readBoundedJson } from "@/lib/security/request";
import { validateCustomerCheckout } from "@/lib/validation/checkout";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeCouponCode,
  validateCoupon,
  calculateCouponDiscount,
} from "@/lib/coupons";

export async function POST(request) {
  // 1. Enforce rate limiting on public order creation (15 orders / 10 minutes per IP)
  const rateLimitResult = await orderCreateRateLimit(request);
  if (!rateLimitResult.success) {
    return rateLimitResponse(
      rateLimitResult,
      "Too many order creation requests. Please wait a few moments before trying again."
    );
  }

  // 2. Read bounded JSON body (max 64KB)
  let body;
  try {
    body = await readBoundedJson(request, { maxBytes: 64 * 1024 });
  } catch (err) {
    const status = err.statusCode || 400;
    return NextResponse.json({ error: err.message || "Invalid request body" }, { status });
  }

  const headerIdempotencyKey = request.headers.get("x-idempotency-key") || request.headers.get("idempotency-key");
  const {
    customer,
    items,
    orderId: clientOrderId,
    idempotencyKey: bodyIdempotencyKey,
    couponCode: rawCouponCode,
    coupon: altCouponCode,
  } = body || {};
  const idempotencyKey = bodyIdempotencyKey || headerIdempotencyKey || null;

  // 3. Validate Customer Contact & Shipping Fields (Strict Server-Side Validation)
  const validation = validateCustomerCheckout(customer);
  if (!validation.isValid) {
    return NextResponse.json(
      { error: validation.firstError || "Invalid customer shipping details.", errors: validation.errors },
      { status: 400 }
    );
  }

  const validatedCustomer = validation.normalized;

  // 4. Validate Cart Items Array
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return NextResponse.json({ error: "Cart must contain between 1 and 50 items." }, { status: 400 });
  }

  // 5. Reconstruct lines & price totals strictly from server-side product catalog
  const lines = [];
  const itemsData = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId || p.slug === item.productId);
    const size = product?.sizes.find((s) => s.sku === item.sizeSku);
    const qty = Number(item.qty);

    if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }

    if (!size.inStock) {
      return NextResponse.json(
        { error: `${product.name} (${size.weight}) is out of stock` },
        { status: 400 }
      );
    }

    const unitPrice = size.price;
    const lineTotal = unitPrice * qty;

    lines.push({
      name: product.name,
      weight: size.weight,
      sku: size.sku,
      qty,
      unitPrice,
      lineTotal,
    });

    itemsData.push({
      product_id: product.id,
      product_name: product.name,
      size_sku: size.sku,
      weight: size.weight,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  // 6. Calculate Server-Side Subtotal & Shipping (INR)
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shippingCost = 0;

  // 7. Check for existing order under same idempotency key + customer email context
  // Ensures repeated idempotent requests return original order even if a single-use coupon was consumed
  const supabase = createServerSupabaseClient();
  let existingOrder = null;

  if (idempotencyKey || clientOrderId) {
    let existingQuery = supabase
      .from("orders")
      .select(
        "id, buzzora_order_id, customer_email, idempotency_key, coupon_code, coupon_discount_percent, coupon_discount_amount, subtotal, shipping_cost, total, status, created_at"
      );

    if (idempotencyKey && clientOrderId) {
      existingQuery = existingQuery.or(
        `and(idempotency_key.eq.${idempotencyKey},customer_email.eq.${validatedCustomer.email}),buzzora_order_id.eq.${clientOrderId}`
      );
    } else if (idempotencyKey) {
      existingQuery = existingQuery
        .eq("idempotency_key", idempotencyKey)
        .eq("customer_email", validatedCustomer.email);
    } else {
      existingQuery = existingQuery.eq("buzzora_order_id", clientOrderId);
    }

    const { data: matchedOrder } = await existingQuery.maybeSingle();
    if (matchedOrder && matchedOrder.customer_email?.toLowerCase() === validatedCustomer.email.toLowerCase()) {
      existingOrder = matchedOrder;
    }
  }

  // 8. Server-Authoritative Coupon Evaluation & Discount Calculation
  let appliedCouponCode = null;
  let couponDiscountPercent = null;
  let couponDiscountAmount = 0;
  let finalTotal = subtotal + shippingCost;

  if (existingOrder) {
    // Idempotent retry: lock to original authoritative coupon snapshot & financial totals
    appliedCouponCode = existingOrder.coupon_code || null;
    couponDiscountPercent =
      existingOrder.coupon_discount_percent != null
        ? Number(existingOrder.coupon_discount_percent)
        : null;
    couponDiscountAmount = Number(existingOrder.coupon_discount_amount || 0);
    finalTotal = Number(existingOrder.total);
  } else {
    const candidateCouponCode = rawCouponCode || altCouponCode || null;
    if (candidateCouponCode) {
      const normalizedCode = normalizeCouponCode(candidateCouponCode);
      if (!normalizedCode) {
        return NextResponse.json({ error: "Invalid coupon code format." }, { status: 400 });
      }

      let couponRecord = null;
      try {
        const { data, error: couponErr } = await supabase
          .from("coupons")
          .select(
            "id, code, discount_percent, is_active, minimum_order_amount, maximum_discount_amount, starts_at, expires_at, usage_limit, usage_count, deleted_at"
          )
          .ilike("code", normalizedCode)
          .is("deleted_at", null)
          .maybeSingle();

        if (couponErr && !couponErr.message?.includes("coupons")) {
          console.error("[POST /api/orders] Coupon lookup error:", couponErr.message);
          return NextResponse.json({ error: "Unable to verify coupon." }, { status: 500 });
        }
        couponRecord = data;
      } catch (err) {
        console.error("[POST /api/orders] Coupon lookup exception:", err.message);
      }

      // Strict validation
      const couponValidation = validateCoupon(couponRecord, subtotal);
      if (!couponValidation.isValid) {
        return NextResponse.json(
          { error: couponValidation.error || "Invalid coupon code." },
          { status: 400 }
        );
      }

      // Authoritative calculation
      const calcResult = calculateCouponDiscount({
        subtotal,
        shippingCost,
        discountPercent: Number(couponRecord.discount_percent),
        maximumDiscountAmount: couponRecord.maximum_discount_amount
          ? Number(couponRecord.maximum_discount_amount)
          : null,
      });

      appliedCouponCode = couponRecord.code.toUpperCase();
      couponDiscountPercent = Number(couponRecord.discount_percent);
      couponDiscountAmount = calcResult.discountAmount;
      finalTotal = calcResult.finalTotal;
    }
  }

  // 9. Generate / Preserve Unique Public Buzzora Order ID (e.g. 'BZ-LVT26K1L-X9A1')
  const buzzoraOrderId = existingOrder ? existingOrder.buzzora_order_id : (clientOrderId || newOrderId());

  // 10. Save Order & Items Atomically to Supabase PostgreSQL Database via RPC
  try {
    const dbResult = await createOrderRecord({
      orderData: {
        buzzora_order_id: buzzoraOrderId,
        customer_name: validatedCustomer.name,
        customer_email: validatedCustomer.email,
        customer_phone: validatedCustomer.phone,
        shipping_address: validatedCustomer.address,
        city: validatedCustomer.city,
        state: validatedCustomer.state,
        postcode: validatedCustomer.postcode,
        country: validatedCustomer.country,
        subtotal: existingOrder ? Number(existingOrder.subtotal) : subtotal,
        shipping_cost: existingOrder ? Number(existingOrder.shipping_cost) : shippingCost,
        total: finalTotal,
        coupon_code: appliedCouponCode,
        coupon_discount_percent: couponDiscountPercent,
        coupon_discount_amount: couponDiscountAmount,
      },
      itemsData,
      idempotencyKey,
    });

    // 11. Return Response Compatible with Existing Checkout UI
    const verificationToken = generateOrderVerificationToken(
      dbResult.buzzoraOrderId,
      validatedCustomer.email
    );

    const orderResponse = {
      id: dbResult.buzzoraOrderId,
      orderId: dbResult.buzzoraOrderId,
      dbOrderId: dbResult.orderId || (existingOrder ? existingOrder.id : undefined),
      isDuplicate: Boolean(dbResult.isDuplicate || existingOrder),
      status: "pending-confirmation",
      paymentMethod: process.env.PAYMENT_PROVIDER || "manual",
      verificationToken,
      customer: {
        name: validatedCustomer.name,
        email: validatedCustomer.email,
        phone: validatedCustomer.phone,
        address: validatedCustomer.address,
        city: validatedCustomer.city,
        state: validatedCustomer.state,
        postcode: validatedCustomer.postcode,
        country: validatedCustomer.country,
      },
      lines,
      subtotal: existingOrder ? Number(existingOrder.subtotal) : subtotal,
      shipping: existingOrder ? Number(existingOrder.shipping_cost) : shippingCost,
      discount: couponDiscountAmount,
      couponCode: appliedCouponCode,
      couponDiscountPercent,
      total: finalTotal,
      createdAt: dbResult.createdAt || (existingOrder ? existingOrder.created_at : new Date().toISOString()),
    };

    return NextResponse.json({ order: orderResponse });
  } catch (error) {
    console.error("[POST /api/orders Error]:", error?.message || error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error?.message || "Failed to create atomic order in database." },
      { status }
    );
  }
}
