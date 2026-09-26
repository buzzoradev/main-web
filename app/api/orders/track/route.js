import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateOrderVerificationToken } from "@/lib/security";
import { buildOrderTimeline, ORDER_STAGES } from "@/lib/order";
import { orderTrackRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";
import { readBoundedJson, isValidOrderId } from "@/lib/security/request";

export const STAGES = ORDER_STAGES;

export async function POST(request) {
  // 1. Enforce rate limiting on customer tracking lookups (10 requests / 5 minutes)
  const rateLimitResult = await orderTrackRateLimit(request);
  if (!rateLimitResult.success) {
    return rateLimitResponse(
      rateLimitResult,
      "Too many tracking requests. Please wait a few minutes before trying again."
    );
  }

  // 2. Read bounded JSON body (max 10KB)
  let body;
  try {
    body = await readBoundedJson(request, { maxBytes: 10 * 1024 });
  } catch (err) {
    const status = err.statusCode || 400;
    return NextResponse.json({ error: err.message || "Invalid request body" }, { status });
  }

  const { buzzoraOrderId, emailOrPhone } = body || {};

  // Standard generic anti-enumeration error message
  const genericErrorMessage =
    "No order found matching the provided Order ID and contact details. Please verify your information and try again.";

  if (
    !buzzoraOrderId ||
    typeof buzzoraOrderId !== "string" ||
    !isValidOrderId(buzzoraOrderId)
  ) {
    return NextResponse.json({ error: "Invalid Buzzora Order ID format." }, { status: 400 });
  }

  if (!emailOrPhone || typeof emailOrPhone !== "string" || !emailOrPhone.trim()) {
    return NextResponse.json(
      { error: "Please provide the email address or phone number used during checkout." },
      { status: 400 }
    );
  }

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();
  const cleanVerifier = emailOrPhone.trim().toLowerCase();
  const digitsVerifier = cleanVerifier.replace(/[^0-9]/g, "");

  const supabase = createServerSupabaseClient();

  let order = null;

  // Try selecting full schema including courier tracking fields and timestamps
  const { data: fullData, error: fullError } = await supabase
    .from("orders")
    .select(
      "id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, courier_name, tracking_number, tracking_url, shipped_at, delivered_at, created_at"
    )
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (fullError && (fullError.message?.includes("courier_name") || fullError.code === "PGRST204")) {
    // Fallback if courier columns haven't been migrated on remote DB yet
    const { data: baseData, error: baseError } = await supabase
      .from("orders")
      .select(
        "id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, created_at"
      )
      .eq("buzzora_order_id", cleanOrderId)
      .single();

    if (baseError || !baseData) {
      return NextResponse.json({ error: genericErrorMessage }, { status: 404 });
    }
    order = baseData;
  } else if (fullError || !fullData) {
    return NextResponse.json({ error: genericErrorMessage }, { status: 404 });
  } else {
    order = fullData;
  }

  // Security Verification Check: Verifier must match email OR phone number
  const dbEmail = (order.customer_email || "").trim().toLowerCase();
  const dbPhoneDigits = (order.customer_phone || "").replace(/[^0-9]/g, "");

  const emailMatched = dbEmail === cleanVerifier;
  const phoneMatched =
    digitsVerifier.length >= 6 &&
    (dbPhoneDigits.endsWith(digitsVerifier) || digitsVerifier.endsWith(dbPhoneDigits));

  // Anti-enumeration defense: return the exact same generic error if verification fails
  if (!emailMatched && !phoneMatched) {
    return NextResponse.json({ error: genericErrorMessage }, { status: 404 });
  }

  // Fetch Order Items (Do NOT expose internal DB IDs)
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  if (itemsError) {
    return NextResponse.json({ error: "Could not load order line items." }, { status: 500 });
  }

  // Query Latest Payment Status Minimally (Do NOT expose raw provider_response)
  const { data: payments } = await supabase
    .from("payments")
    .select("payment_status")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const paymentStatus =
    payments?.[0]?.payment_status || (order.status === "CONFIRMED" ? "SUCCESS" : "PENDING");

  const lines = (items || []).map((i) => ({
    name: i.product_name,
    weight: i.weight,
    sku: i.size_sku,
    qty: i.quantity,
    unitPrice: Number(i.unit_price),
    lineTotal: Number(i.line_total),
  }));

  // Build Status Timeline adhering to Buzzora fulfillment state semantics
  const currentStatus = (order.status || "PENDING").toUpperCase();
  const timeline = buildOrderTimeline(currentStatus);

  const trackedOrder = {
    id: order.buzzora_order_id,
    status: currentStatus,
    paymentStatus,
    createdAt: order.created_at,
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
    lines,
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
    timeline,
    verificationToken: generateOrderVerificationToken(
      order.buzzora_order_id,
      order.customer_email
    ),
  };

  return NextResponse.json({ order: trackedOrder });
}
