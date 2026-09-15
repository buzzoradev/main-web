import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyPhonePeWebhook, getPhonePeOrderStatus } from "@/lib/phonepe/server";

export async function POST(request) {
  // A1 & A2. Read raw request body & verify HMAC authentication BEFORE JSON parsing
  let rawBody;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error("[PhonePe Webhook Error]: Could not read raw request body:", err.message);
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }

  const authVerification = verifyPhonePeWebhook({
    rawBody,
    headers: request.headers,
  });

  if (!authVerification.isValid) {
    console.warn("[PhonePe Webhook Warning]: Unauthorized webhook request:", authVerification.error);
    return NextResponse.json({ error: authVerification.error || "Unauthorized webhook signature." }, { status: 401 });
  }

  // A3. Parse JSON payload only after verification
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[PhonePe Webhook Error]: Malformed JSON body:", err.message);
    return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
  }

  // A4. Validate Event Type
  const event = payload.event || payload.eventType || payload.data?.event || "UNKNOWN";
  console.log(`[PhonePe Webhook]: Received authenticated event: '${event}'`);

  const supportedEvents = ["checkout.order.completed", "checkout.order.failed"];
  if (!supportedEvents.includes(event)) {
    return NextResponse.json({ acknowledged: true, message: `Event '${event}' safely acknowledged.` });
  }

  // A5. Identify Payment Attempt Identifier
  const merchantOrderId =
    payload.merchantOrderId ||
    payload.data?.merchantOrderId ||
    payload.payload?.merchantOrderId ||
    payload.data?.merchantTransactionId;

  if (!merchantOrderId || typeof merchantOrderId !== "string") {
    console.warn("[PhonePe Webhook Warning]: Missing merchantOrderId in webhook payload.");
    return NextResponse.json({ acknowledged: true, message: "Missing merchantOrderId." });
  }

  const supabase = createServerSupabaseClient();

  // Find matching payment attempt in public.payments
  const { data: payment, error: paymentErr } = await supabase
    .from("payments")
    .select("id, order_id, merchant_transaction_id, amount, payment_status, provider_transaction_id")
    .eq("merchant_transaction_id", merchantOrderId.trim())
    .single();

  if (paymentErr || !payment) {
    console.warn(`[PhonePe Webhook Warning]: No payment attempt found for merchantOrderId '${merchantOrderId}'.`);
    return NextResponse.json({ acknowledged: true, message: "Payment attempt not found." });
  }

  // Find associated public.orders row
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status, total")
    .eq("id", payment.order_id)
    .single();

  if (orderErr || !order) {
    console.error(`[PhonePe Webhook Error]: Order '${payment.order_id}' not found for payment '${payment.id}'.`);
    return NextResponse.json({ error: "Associated order record missing." }, { status: 500 });
  }

  // A10. Idempotency Check (Terminal SUCCESS protection)
  if (payment.payment_status === "SUCCESS") {
    console.log(`[PhonePe Webhook]: Payment '${merchantOrderId}' is already SUCCESS. Safe idempotent acknowledgement.`);
    return NextResponse.json({ success: true, message: "Payment already processed as SUCCESS." });
  }

  // A11. Handle checkout.order.failed Event
  if (event === "checkout.order.failed") {
    if (payment.payment_status === "PENDING") {
      const { error: updateErr } = await supabase
        .from("payments")
        .update({
          payment_status: "FAILED",
          provider_response: {
            event,
            code: payload.code || payload.data?.code || "PAYMENT_FAILED",
            updatedAt: new Date().toISOString(),
          },
        })
        .eq("id", payment.id)
        .eq("payment_status", "PENDING");

      if (updateErr) {
        console.error("[PhonePe Webhook Error]: Failed to update payment status to FAILED:", updateErr.message);
        return NextResponse.json({ error: "Database update error." }, { status: 500 });
      }
    }
    // Note: orders.status remains PENDING so customer can retry
    return NextResponse.json({ success: true, message: "Payment attempt marked FAILED." });
  }

  // A6. Handle checkout.order.completed Event -> Server-to-Server Verification with PhonePe Status API
  if (event === "checkout.order.completed") {
    let statusResult;
    try {
      statusResult = await getPhonePeOrderStatus(merchantOrderId);
    } catch (err) {
      console.error(`[PhonePe Webhook Error]: Failed status API check for '${merchantOrderId}':`, err.message);
      return NextResponse.json({ error: "Failed server status check with PhonePe." }, { status: 502 });
    }

    if (!statusResult.isSuccess) {
      console.warn(`[PhonePe Webhook Warning]: PhonePe status API returned non-success state '${statusResult.state}' for '${merchantOrderId}'.`);
      if (statusResult.isFailed && payment.payment_status === "PENDING") {
        await supabase
          .from("payments")
          .update({
            payment_status: "FAILED",
            provider_response: {
              state: statusResult.state,
              code: statusResult.code,
              updatedAt: new Date().toISOString(),
            },
          })
          .eq("id", payment.id)
          .eq("payment_status", "PENDING");
      }
      return NextResponse.json({ error: "Payment verification failed with PhonePe gateway." }, { status: 400 });
    }

    // A7. Verify Authoritative Amount
    const expectedPaisa = Math.round(Number(payment.amount) * 100);
    const verifiedPaisa = statusResult.amount;

    if (verifiedPaisa !== null && verifiedPaisa !== expectedPaisa) {
      console.error(
        `[PhonePe Webhook Security Alert]: Amount mismatch for '${merchantOrderId}'. DB Expected: ${expectedPaisa} paisa, PhonePe Verified: ${verifiedPaisa} paisa.`
      );
      await supabase
        .from("payments")
        .update({
          payment_status: "FAILED",
          provider_response: {
            error: "Security Alert: Amount mismatch between DB payment record and PhonePe status API.",
            expectedPaisa,
            verifiedPaisa,
          },
        })
        .eq("id", payment.id);

      return NextResponse.json({ error: "Amount mismatch detected." }, { status: 400 });
    }

    // A8 & A9. Transition Payment to SUCCESS & Order to CONFIRMED
    const nowIso = new Date().toISOString();
    const providerTxId = statusResult.providerTransactionId || payment.provider_transaction_id;

    // Update Payment record to SUCCESS
    const { error: payUpdateErr } = await supabase
      .from("payments")
      .update({
        payment_status: "SUCCESS",
        provider_transaction_id: providerTxId,
        paid_at: nowIso,
        provider_response: {
          event,
          state: statusResult.state,
          code: statusResult.code,
          verifiedAmount: verifiedPaisa,
          updatedAt: nowIso,
        },
      })
      .eq("id", payment.id)
      .neq("payment_status", "SUCCESS");

    if (payUpdateErr) {
      console.error("[PhonePe Webhook Error]: Failed to update payment status to SUCCESS:", payUpdateErr.message);
      return NextResponse.json({ error: "Database payment update failed." }, { status: 500 });
    }

    // Update Orders record to CONFIRMED (only if PENDING)
    if (order.status === "PENDING") {
      const { error: orderUpdateErr } = await supabase
        .from("orders")
        .update({
          status: "CONFIRMED",
        })
        .eq("id", order.id)
        .eq("status", "PENDING");

      if (orderUpdateErr) {
        console.error("[PhonePe Webhook Error]: Failed to update order status to CONFIRMED:", orderUpdateErr.message);
        return NextResponse.json({ error: "Database order status update failed." }, { status: 500 });
      }
    }

    console.log(`[PhonePe Webhook Success]: Payment '${merchantOrderId}' -> SUCCESS, Order '${order.buzzora_order_id}' -> CONFIRMED.`);
    return NextResponse.json({ success: true, buzzoraOrderId: order.buzzora_order_id });
  }

  return NextResponse.json({ acknowledged: true });
}
