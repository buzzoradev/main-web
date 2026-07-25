import { NextResponse } from "next/server";
import crypto from "crypto";
import { buildOrder } from "@/lib/order";

// Verifies a Razorpay payment signature server-side. Only a signature that
// matches HMAC-SHA256(order_id|payment_id, key_secret) is accepted — this is
// what prevents a forged client-side "success" from creating a paid order.
export async function POST(request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items } = body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const valid =
    expected.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  if (!valid) {
    return NextResponse.json({ verified: false, error: "Signature mismatch." }, { status: 400 });
  }

  // Rebuild the order server-side and mark it paid.
  const order = buildOrder(Array.isArray(items) ? items : [], {}, {
    paymentMethod: "razorpay",
    id: razorpay_order_id,
  });
  order.status = "paid";
  order.paymentId = razorpay_payment_id;

  // NOTE: with a database, persist the paid order here and rely on the webhook
  // (app/api/razorpay/webhook) as the authoritative confirmation.
  return NextResponse.json({ verified: true, order });
}
