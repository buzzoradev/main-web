import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPhonePeOrderStatus } from "@/lib/phonepe/server";
import { generateOrderVerificationToken } from "@/lib/security";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");

  // B1. Extract Payment Attempt Identifier
  const merchantOrderId =
    searchParams.get("merchantOrderId") ||
    searchParams.get("merchantTransactionId") ||
    searchParams.get("tx") ||
    searchParams.get("id");

  if (!merchantOrderId || typeof merchantOrderId !== "string") {
    console.warn("[PhonePe Callback Warning]: Missing merchantOrderId in callback URL.");
    return NextResponse.redirect(`${cleanSiteUrl}/shop`);
  }

  const supabase = createServerSupabaseClient();

  // B3. Find Payment & Associated Order
  const { data: payment, error: paymentErr } = await supabase
    .from("payments")
    .select("id, order_id, merchant_transaction_id, amount, payment_status, provider_transaction_id")
    .eq("merchant_transaction_id", merchantOrderId.trim())
    .single();

  if (paymentErr || !payment) {
    console.warn(`[PhonePe Callback Warning]: Payment attempt '${merchantOrderId}' not found.`);
    return NextResponse.redirect(`${cleanSiteUrl}/shop`);
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, customer_email, status, total")
    .eq("id", payment.order_id)
    .single();

  if (orderErr || !order) {
    console.error(`[PhonePe Callback Error]: Order '${payment.order_id}' not found.`);
    return NextResponse.redirect(`${cleanSiteUrl}/shop`);
  }

  const vt = generateOrderVerificationToken(order.buzzora_order_id, order.customer_email);

  // Fast Path: If already SUCCESS & CONFIRMED (e.g. processed by Webhook first)
  if (payment.payment_status === "SUCCESS" || order.status === "CONFIRMED") {
    return NextResponse.redirect(
      `${cleanSiteUrl}/order-success?order=${encodeURIComponent(order.buzzora_order_id)}&vt=${encodeURIComponent(vt)}`
    );
  }

  // B2. Perform Server-Side Status Check with PhonePe
  let statusResult;
  try {
    statusResult = await getPhonePeOrderStatus(merchantOrderId);
  } catch (err) {
    console.error(`[PhonePe Callback Error]: Status API check failed for '${merchantOrderId}':`, err.message);
    return NextResponse.redirect(
      `${cleanSiteUrl}/checkout?order=${encodeURIComponent(order.buzzora_order_id)}&status=pending_verification`
    );
  }

  // B4. Handle Verified COMPLETED Status
  if (statusResult.isSuccess) {
    const expectedPaisa = Math.round(Number(payment.amount) * 100);
    const verifiedPaisa = statusResult.amount;

    if (verifiedPaisa !== null && verifiedPaisa !== expectedPaisa) {
      console.error(`[PhonePe Callback Security Alert]: Amount mismatch on callback for '${merchantOrderId}'.`);
      return NextResponse.redirect(
        `${cleanSiteUrl}/checkout?order=${encodeURIComponent(order.buzzora_order_id)}&error=amount_mismatch`
      );
    }

    const nowIso = new Date().toISOString();
    const providerTxId = statusResult.providerTransactionId || payment.provider_transaction_id;

    // Atomic DB Updates
    await supabase
      .from("payments")
      .update({
        payment_status: "SUCCESS",
        provider_transaction_id: providerTxId,
        paid_at: nowIso,
        provider_response: {
          source: "browser_callback",
          state: statusResult.state,
          code: statusResult.code,
          verifiedAmount: verifiedPaisa,
          updatedAt: nowIso,
        },
      })
      .eq("id", payment.id)
      .neq("payment_status", "SUCCESS");

    if (order.status === "PENDING") {
      await supabase
        .from("orders")
        .update({ status: "CONFIRMED" })
        .eq("id", order.id)
        .eq("status", "PENDING");
    }

    return NextResponse.redirect(
      `${cleanSiteUrl}/order-success?order=${encodeURIComponent(order.buzzora_order_id)}&vt=${encodeURIComponent(vt)}`
    );
  }

  // B5. Handle FAILED Status
  if (statusResult.isFailed) {
    if (payment.payment_status === "PENDING") {
      await supabase
        .from("payments")
        .update({
          payment_status: "FAILED",
          provider_response: {
            source: "browser_callback",
            state: statusResult.state,
            code: statusResult.code,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq("id", payment.id)
        .eq("payment_status", "PENDING");
    }

    // Keep orders.status = PENDING so customer can retry
    return NextResponse.redirect(
      `${cleanSiteUrl}/checkout?order=${encodeURIComponent(order.buzzora_order_id)}&error=payment_failed`
    );
  }

  // B6. Handle Still PENDING / UNKNOWN Status
  return NextResponse.redirect(
    `${cleanSiteUrl}/checkout?order=${encodeURIComponent(order.buzzora_order_id)}&status=pending`
  );
}
