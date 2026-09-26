import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyOrderTokenDetailed } from "@/lib/security";
import { orderDetailRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";
import { isValidOrderId } from "@/lib/security/request";

export async function GET(request, { params }) {
  const buzzoraOrderId = params?.id;

  // 1. Strict format validation on Order ID
  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string" || !isValidOrderId(buzzoraOrderId)) {
    return NextResponse.json(
      { error: "Invalid Buzzora Order ID format." },
      { status: 400 }
    );
  }

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();

  // 2. Distributed Rate Limiting on order verification attempts
  const rateLimitResult = await orderDetailRateLimit(request, cleanOrderId);
  if (!rateLimitResult.success) {
    return rateLimitResponse(
      rateLimitResult,
      "Too many verification attempts for this order. Please wait a few minutes."
    );
  }

  // 3. Extract verification token (vt) from search params or authorization headers
  const { searchParams } = new URL(request.url);
  const vt =
    searchParams.get("vt") ||
    request.headers.get("x-order-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  // 4. ENFORCE AUTHENTICATION: Order ID alone is strictly insufficient
  if (!vt) {
    return NextResponse.json(
      { error: "Order verification token is required to view order details." },
      { status: 401 }
    );
  }

  // 5. Verify cryptographic signature, expiration, and order binding BEFORE querying DB
  const auth = verifyOrderTokenDetailed(cleanOrderId, vt);
  if (!auth.isValid) {
    return NextResponse.json(
      { error: "Invalid or expired order verification token." },
      { status: 401 }
    );
  }

  // 6. Query Supabase for authoritative order (resilient to optional courier columns)
  const supabase = createServerSupabaseClient();
  let order = null;

  const { data: fullOrder, error: fullError } = await supabase
    .from("orders")
    .select(
      "id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, courier_name, tracking_number, tracking_url, shipped_at, delivered_at, created_at"
    )
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (fullError && (fullError.message?.includes("courier_name") || fullError.code === "PGRST204")) {
    const { data: baseOrder, error: baseError } = await supabase
      .from("orders")
      .select(
        "id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, created_at"
      )
      .eq("buzzora_order_id", cleanOrderId)
      .single();

    if (baseError || !baseOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    order = baseOrder;
  } else if (fullError || !fullOrder) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  } else {
    order = fullOrder;
  }

  // 7. Query Line Items (Do NOT expose internal DB IDs)
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  if (itemsError) {
    return NextResponse.json({ error: "Could not load order line items." }, { status: 500 });
  }

  // 8. Query Latest Payment Status Minimally (Do NOT expose raw provider_response)
  const { data: payments } = await supabase
    .from("payments")
    .select("payment_status")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const paymentStatus =
    payments?.[0]?.payment_status || (order.status === "CONFIRMED" ? "SUCCESS" : "PENDING");

  // 9. Construct customer-facing sanitized payload (Data Minimization)
  const safeOrder = {
    id: order.buzzora_order_id,
    status: order.status,
    paymentStatus,
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
    lines: (items || []).map((i) => ({
      name: i.product_name,
      weight: i.weight,
      sku: i.size_sku,
      qty: i.quantity,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping_cost),
    total: Number(order.total),
    currency: order.currency || "INR",
    courier: {
      name: order.courier_name || null,
      trackingNumber: order.tracking_number || null,
      trackingUrl: order.tracking_url || null,
      shippedAt: order.shipped_at || null,
      deliveredAt: order.delivered_at || null,
    },
    createdAt: order.created_at,
    isAuthorized: true,
  };

  return NextResponse.json({ order: safeOrder });
}
