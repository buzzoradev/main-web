import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Verify Svix webhook signature format according to Resend documentation
function verifyResendWebhookSignature({ payload, headers, secret }) {
  if (!secret) return false;

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Prevent replay attacks (5 minute window)
  const timestampNum = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300) {
    return false;
  }

  try {
    const rawSecret = secret.startsWith("whsec_") ? secret.substring(6) : secret;
    const secretBytes = Buffer.from(rawSecret, "base64");
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
    const computedSignature = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    const signatures = svixSignature.split(" ").map((s) => s.trim());
    for (const versionedSig of signatures) {
      const [version, sig] = versionedSig.split(",");
      if (version === "v1" && sig) {
        const sigBuffer = Buffer.from(sig);
        const computedBuffer = Buffer.from(computedSignature);
        if (
          sigBuffer.length === computedBuffer.length &&
          crypto.timingSafeEqual(sigBuffer, computedBuffer)
        ) {
          return true;
        }
      }
    }
  } catch (err) {
    console.error("[ResendWebhook] Error verifying signature:", err.message);
    return false;
  }

  return false;
}

export async function POST(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("[ResendWebhook] RESEND_WEBHOOK_SECRET not configured. Rejecting request.");
    return NextResponse.json(
      { error: "Webhook endpoint not configured" },
      { status: 503 }
    );
  }

  let rawBody;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const isValid = verifyResendWebhookSignature({
    payload: rawBody,
    headers: req.headers,
    secret,
  });

  if (!isValid) {
    console.warn("[ResendWebhook] Invalid signature received.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const eventType = event?.type;
  const resendEmailId = event?.data?.email_id;

  if (!eventType || !resendEmailId) {
    return NextResponse.json({ received: true, ignored: true, reason: "Missing event metadata" });
  }

  // Operational metadata only: NEVER touch orders or payments table!
  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  try {
    if (eventType === "email.delivered") {
      await supabase
        .from("order_email_events")
        .update({
          status: "DELIVERED",
          updated_at: nowIso,
        })
        .eq("resend_email_id", resendEmailId);
    } else if (eventType === "email.bounced") {
      const bounceReason = event.data?.bounce?.message || "Email bounced";
      await supabase
        .from("order_email_events")
        .update({
          status: "BOUNCED",
          last_error: bounceReason.slice(0, 300),
          updated_at: nowIso,
        })
        .eq("resend_email_id", resendEmailId);
    } else if (eventType === "email.complained") {
      await supabase
        .from("order_email_events")
        .update({
          status: "COMPLAINED",
          updated_at: nowIso,
        })
        .eq("resend_email_id", resendEmailId);
    }

    return NextResponse.json({ received: true, eventType, resendEmailId });
  } catch (dbErr) {
    console.error("[ResendWebhook] Error recording email event status:", dbErr.message);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
