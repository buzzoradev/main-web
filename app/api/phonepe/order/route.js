import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { initiatePhonePePayment } from "@/lib/phonepe/server";
import { isPhonePeMockModeEnabled, initiateMockPhonePePayment } from "@/lib/phonepe/mock";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { buzzoraOrderId } = body || {};

  // Step 1: Input Validation
  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string" || !/^BZ-[A-Z0-9-]+$/i.test(buzzoraOrderId.trim())) {
    return NextResponse.json(
      { error: "Invalid or missing buzzoraOrderId. Must be a valid Buzzora Order ID string." },
      { status: 400 }
    );
  }

  const cleanBuzzoraOrderId = buzzoraOrderId.trim();

  // Step 2: Load Authoritative Order from Supabase
  const supabase = createServerSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status, subtotal, shipping_cost, total, currency, customer_phone")
    .eq("buzzora_order_id", cleanBuzzoraOrderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Validate Order Status
  if (order.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "Order has already been confirmed/paid.", buzzoraOrderId: cleanBuzzoraOrderId, status: "CONFIRMED" },
      { status: 400 }
    );
  }

  if (["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status)) {
    return NextResponse.json(
      { error: `Order cannot be paid because status is '${order.status}'.`, buzzoraOrderId: cleanBuzzoraOrderId, status: order.status },
      { status: 400 }
    );
  }

  if (order.status !== "PENDING") {
    return NextResponse.json(
      { error: `Order status '${order.status}' is not eligible for payment.`, buzzoraOrderId: cleanBuzzoraOrderId, status: order.status },
      { status: 400 }
    );
  }

  // Step 3: Load Order Items for verification
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_id, size_sku, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  if (itemsError || !items || items.length === 0) {
    return NextResponse.json({ error: "Order line items not found or invalid." }, { status: 400 });
  }

  // Step 4: Convert Financial Total to Paisa (Server-Derived)
  const numericTotal = Number(order.total);
  if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
    return NextResponse.json({ error: "Invalid order financial total." }, { status: 400 });
  }
  const amountInPaisa = Math.round(numericTotal * 100);
  if (!Number.isInteger(amountInPaisa) || amountInPaisa <= 0) {
    return NextResponse.json({ error: "Calculated amount in paisa must be a positive integer." }, { status: 400 });
  }

  // Step 5: Generate Unique Payment Attempt Identifier (merchant_transaction_id)
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  let merchantTransactionId = `MT-${cleanBuzzoraOrderId}-${randomSuffix}`;
  if (merchantTransactionId.length > 63) {
    const shortId = cleanBuzzoraOrderId.slice(0, 30);
    merchantTransactionId = `MT-${shortId}-${randomSuffix}`;
  }

  // Step 6: Insert Payment Attempt Row in public.payments BEFORE Calling PhonePe
  const { data: paymentRecord, error: insertPaymentError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      payment_provider: "phonepe",
      merchant_transaction_id: merchantTransactionId,
      amount: numericTotal,
      currency: order.currency || "INR",
      payment_status: "PENDING",
      provider_transaction_id: null,
      provider_response: null,
    })
    .select("id, merchant_transaction_id, payment_status")
    .single();

  if (insertPaymentError || !paymentRecord) {
    console.error("[POST /api/phonepe/order] Payment insert error:", insertPaymentError?.message);
    return NextResponse.json({ error: "Failed to record payment attempt in database." }, { status: 500 });
  }

  // Step 7: Construct Redirect Callback URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const redirectUrl = `${cleanSiteUrl}/api/phonepe/callback`;

  // Step 8 & 9: Call PhonePe API (or Development Mock Provider) & Handle Initiation
  try {
    const phonePeResult = isPhonePeMockModeEnabled()
      ? await initiateMockPhonePePayment({
          merchantOrderId: merchantTransactionId,
          amountInPaisa,
          redirectUrl,
        })
      : await initiatePhonePePayment({
          merchantOrderId: merchantTransactionId,
          amountInPaisa,
          redirectUrl,
          customerPhone: order.customer_phone,
          metaInfo: {
            udf1: cleanBuzzoraOrderId,
          },
        });

    const providerTxId =
      phonePeResult.rawResponse?.transactionId ||
      phonePeResult.rawResponse?.data?.transactionId ||
      (phonePeResult.isMock ? `MOCK_TX_${paymentRecord.id.slice(0, 8)}` : null);

    // Update payment record with provider metadata
    await supabase
      .from("payments")
      .update({
        provider_transaction_id: providerTxId,
        provider_response: {
          tokenUrl: phonePeResult.tokenUrl,
          code: phonePeResult.rawResponse?.code || "PAYMENT_INITIATED",
          isMock: Boolean(phonePeResult.isMock),
        },
      })
      .eq("id", paymentRecord.id);

    // Return client-safe response
    return NextResponse.json({
      success: true,
      buzzoraOrderId: cleanBuzzoraOrderId,
      merchantOrderId: merchantTransactionId,
      redirectUrl: phonePeResult.redirectUrl,
      tokenUrl: phonePeResult.tokenUrl,
    });
  } catch (phonePeError) {
    console.error("[POST /api/phonepe/order] PhonePe initiation error:", phonePeError.message);

    // Mark the payment attempt as FAILED in database
    await supabase
      .from("payments")
      .update({
        payment_status: "FAILED",
        provider_response: {
          error: phonePeError.message || "Failed to initiate PhonePe payment",
        },
      })
      .eq("id", paymentRecord.id);

    return NextResponse.json(
      { error: phonePeError.message || "Could not initiate PhonePe payment attempt. Please try again." },
      { status: 502 }
    );
  }
}
