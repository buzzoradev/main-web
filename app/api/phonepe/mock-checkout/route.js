import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isPhonePeMockModeEnabled, simulateMockWebhook } from "@/lib/phonepe/mock";

export async function GET(request) {
  // Fail closed in production
  if (process.env.NODE_ENV === "production" || !isPhonePeMockModeEnabled()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const merchantOrderId = searchParams.get("merchantOrderId");

  if (!merchantOrderId || typeof merchantOrderId !== "string") {
    return NextResponse.json({ error: "Missing merchantOrderId" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, merchant_transaction_id, amount, payment_status")
    .eq("merchant_transaction_id", merchantOrderId.trim())
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Payment attempt not found" }, { status: 404 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status, total")
    .eq("id", payment.order_id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buzzora PhonePe Sandbox Mock</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fdfaf6; color: #1c1917; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .card { background: white; border: 1px solid #e7e5e4; border-radius: 1.5rem; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .badge { background: #fef3c7; color: #92400e; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
    h1 { font-size: 1.5rem; font-weight: 800; margin-top: 0.75rem; margin-bottom: 1.5rem; color: #292524; }
    .detail-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f5f5f4; font-size: 0.9375rem; }
    .detail-label { color: #78716c; }
    .detail-value { font-weight: 600; color: #1c1917; }
    .actions { margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .btn { width: 100%; padding: 0.875rem 1rem; border-radius: 0.75rem; font-weight: 700; font-size: 0.9375rem; cursor: pointer; border: none; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn-success { background-color: #16a34a; color: white; }
    .btn-failed { background-color: #dc2626; color: white; }
    .btn-cancel { background-color: #78716c; color: white; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">DEVELOPMENT TESTING ONLY</span>
    <h1>BUZZORA PHONEPE SANDBOX MOCK</h1>
    
    <div class="detail-row">
      <span class="detail-label">Buzzora Order ID</span>
      <span class="detail-value">${order.buzzora_order_id}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Authoritative Total</span>
      <span class="detail-value">₹${Number(order.total).toLocaleString('en-IN')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Merchant TX ID</span>
      <span class="detail-value" style="font-size: 0.8rem;">${payment.merchant_transaction_id}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Attempt Status</span>
      <span class="detail-value">${payment.payment_status}</span>
    </div>

    <form method="POST" action="/api/phonepe/mock-checkout" class="actions">
      <input type="hidden" name="merchantOrderId" value="${payment.merchant_transaction_id}" />
      <button type="submit" name="action" value="SUCCESS" class="btn btn-success">Simulate Successful Payment</button>
      <button type="submit" name="action" value="FAILED" class="btn btn-failed">Simulate Failed Payment</button>
      <button type="submit" name="action" value="CANCEL" class="btn btn-cancel">Simulate Cancelled Payment</button>
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request) {
  // Fail closed in production
  if (process.env.NODE_ENV === "production" || !isPhonePeMockModeEnabled()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let merchantOrderId;
  let action;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      merchantOrderId = formData.get("merchantOrderId");
      action = formData.get("action");
    } else {
      const json = await request.json();
      merchantOrderId = json.merchantOrderId;
      action = json.action;
    }
  } catch (err) {
    return NextResponse.json({ error: "Invalid form or JSON body" }, { status: 400 });
  }

  if (!merchantOrderId || !action) {
    return NextResponse.json({ error: "Missing merchantOrderId or action" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");

  if (action === "SUCCESS") {
    await simulateMockWebhook({ merchantOrderId, event: "checkout.order.completed" });
    return NextResponse.redirect(`${cleanSiteUrl}/api/phonepe/callback?merchantOrderId=${encodeURIComponent(merchantOrderId)}`);
  }

  if (action === "FAILED") {
    await simulateMockWebhook({ merchantOrderId, event: "checkout.order.failed" });
    return NextResponse.redirect(`${cleanSiteUrl}/api/phonepe/callback?merchantOrderId=${encodeURIComponent(merchantOrderId)}`);
  }

  if (action === "CANCEL") {
    await simulateMockWebhook({ merchantOrderId, event: "USER_CANCEL" });
    return NextResponse.redirect(`${cleanSiteUrl}/api/phonepe/callback?merchantOrderId=${encodeURIComponent(merchantOrderId)}`);
  }

  return NextResponse.json({ error: "Invalid mock action" }, { status: 400 });
}
