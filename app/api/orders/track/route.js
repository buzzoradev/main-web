import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const STAGES = [
  { id: "CONFIRMED", label: "Order Confirmed", desc: "Your order has been received and verified." },
  { id: "PROCESSING", label: "Processing", desc: "We are carefully packing your honey." },
  { id: "SHIPPED", label: "Shipped", desc: "Your package is on its way with our courier partner." },
  { id: "DELIVERED", label: "Delivered", desc: "Package successfully delivered." },
];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { buzzoraOrderId, emailOrPhone } = body || {};

  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string" || !buzzoraOrderId.trim()) {
    return NextResponse.json({ error: "Please provide a valid Buzzora Order ID." }, { status: 400 });
  }

  if (!emailOrPhone || typeof emailOrPhone !== "string" || !emailOrPhone.trim()) {
    return NextResponse.json(
      { error: "Please provide the email address or phone number used during checkout." },
      { status: 400 }
    );
  }

  const cleanOrderId = buzzoraOrderId.trim();
  const cleanVerifier = emailOrPhone.trim().toLowerCase();
  const digitsVerifier = cleanVerifier.replace(/[^0-9]/g, "");

  const supabase = createServerSupabaseClient();

  let order = null;

  // Try selecting full schema including courier tracking fields
  const { data: fullData, error: fullError } = await supabase
    .from("orders")
    .select(
      "id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, courier_name, tracking_number, tracking_url, created_at"
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
      return NextResponse.json(
        { error: "Order not found. Please double-check your Order ID." },
        { status: 404 }
      );
    }
    order = baseData;
  } else if (fullError || !fullData) {
    return NextResponse.json(
      { error: "Order not found. Please double-check your Order ID." },
      { status: 404 }
    );
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

  if (!emailMatched && !phoneMatched) {
    return NextResponse.json(
      { error: "Verification failed. The email or phone number provided does not match our records for this order." },
      { status: 403 }
    );
  }

  // Fetch Order Items
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  if (itemsError) {
    return NextResponse.json({ error: "Could not load order line items." }, { status: 500 });
  }

  const lines = (items || []).map((i) => ({
    name: i.product_name,
    weight: i.weight,
    sku: i.size_sku,
    qty: i.quantity,
    unitPrice: Number(i.unit_price),
    lineTotal: Number(i.line_total),
  }));

  // Build Status Timeline
  const currentStatus = (order.status || "PENDING").toUpperCase();
  let currentStageIndex = -1;

  if (currentStatus === "CONFIRMED" || currentStatus === "PENDING") {
    currentStageIndex = 0;
  } else if (currentStatus === "PROCESSING") {
    currentStageIndex = 1;
  } else if (currentStatus === "SHIPPED") {
    currentStageIndex = 2;
  } else if (currentStatus === "DELIVERED") {
    currentStageIndex = 3;
  }

  const timeline = STAGES.map((stage, i) => ({
    ...stage,
    completed: currentStatus !== "CANCELLED" && i <= currentStageIndex,
    current: currentStatus !== "CANCELLED" && i === currentStageIndex,
  }));

  const trackedOrder = {
    id: order.buzzora_order_id,
    status: currentStatus,
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
    currency: order.currency,
    courier: {
      name: order.courier_name || null,
      trackingNumber: order.tracking_number || null,
      trackingUrl: order.tracking_url || null,
    },
    timeline,
  };

  return NextResponse.json({ order: trackedOrder });
}
