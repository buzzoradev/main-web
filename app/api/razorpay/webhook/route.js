import { NextResponse } from "next/server";
import crypto from "crypto";

// Razorpay webhook receiver — the authoritative source of truth for payment
// status. Configure the endpoint URL and secret in the Razorpay dashboard and
// set RAZORPAY_WEBHOOK_SECRET. Signature is verified against the raw body.
export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature") || "";
  const raw = await request.text();

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const valid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(raw);
  // TODO (needs a database): on "payment.captured" / "order.paid", mark the
  // matching order paid and trigger the confirmation email. Until persistence
  // is added, we simply acknowledge the event.
  switch (event.event) {
    case "payment.captured":
    case "order.paid":
      // persist paid status here
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
