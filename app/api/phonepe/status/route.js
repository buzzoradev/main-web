import { NextResponse } from "next/server";
import { buildOrder } from "@/lib/order";

function phonePeConfig() {
  const production = process.env.PHONEPE_ENV === "production";
  return {
    clientId: process.env.PHONEPE_CLIENT_ID,
    clientSecret: process.env.PHONEPE_CLIENT_SECRET,
    clientVersion: process.env.PHONEPE_CLIENT_VERSION,
    authUrl:
      process.env.PHONEPE_AUTH_URL ||
      (production
        ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"),
    apiBase:
      process.env.PHONEPE_API_BASE_URL ||
      (production
        ? "https://api.phonepe.com/apis/pg"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox"),
  };
}

async function getAccessToken(config) {
  const response = await fetch(config.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_version: String(config.clientVersion),
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !(data.access_token || data.accessToken)) throw new Error("Could not authenticate with PhonePe.");
  return data.access_token || data.accessToken;
}

export async function POST(request) {
  const config = phonePeConfig();
  if (!config.clientId || !config.clientSecret || !config.clientVersion) {
    return NextResponse.json({ error: "PhonePe payments are not configured yet." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { merchantOrderId, items, customer } = body || {};
  if (!merchantOrderId || !/^BZ-[A-Z0-9-]+$/.test(merchantOrderId) || !Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  try {
    const token = await getAccessToken(config);
    const statusResponse = await fetch(
      `${config.apiBase}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
      { headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${token}` }, cache: "no-store" }
    );
    const statusData = await statusResponse.json();
    if (!statusResponse.ok) return NextResponse.json({ error: "Could not check PhonePe payment status." }, { status: 502 });

    const state = statusData.state || statusData.data?.state;
    const code = statusData.code || statusData.data?.code;
    const completed = state === "COMPLETED" || code === "PAYMENT_SUCCESS";
    if (!completed) return NextResponse.json({ paid: false, state: state || code || "PENDING" }, { status: 202 });

    const order = buildOrder(items, customer || {}, { paymentMethod: "phonepe", id: merchantOrderId });
    if (!order.lines.length || order.lines.length !== items.length) {
      return NextResponse.json({ error: "Invalid order details." }, { status: 400 });
    }
    const paidAmount = Number(statusData.amount ?? statusData.data?.amount);
    if (Number.isFinite(paidAmount) && paidAmount !== order.total * 100) {
      return NextResponse.json({ error: "PhonePe amount mismatch." }, { status: 400 });
    }
    order.status = "paid";
    order.paymentId = merchantOrderId;
    return NextResponse.json({ paid: true, order });
  } catch (error) {
    console.error("PhonePe status check failed", error);
    return NextResponse.json({ error: "Could not verify PhonePe payment." }, { status: 502 });
  }
}
