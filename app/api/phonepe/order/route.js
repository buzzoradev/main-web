import { NextResponse } from "next/server";
import { products } from "@/lib/products";
import { newOrderId } from "@/lib/order";

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

function getCartTotal(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Your cart is empty.");

  let total = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const size = product?.sizes.find((s) => s.sku === item.sizeSku);
    const qty = Number(item.qty);
    if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new Error("Invalid cart item.");
    }
    if (!size.inStock) throw new Error(`${product.name} (${size.weight}) is out of stock.`);
    total += size.price * qty;
  }
  return total;
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
  if (!response.ok || !(data.access_token || data.accessToken)) {
    console.error("PhonePe token request failed", response.status, data?.message || data?.code);
    throw new Error("Could not authenticate with PhonePe.");
  }
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

  let total;
  try {
    total = getCartTotal(body?.items);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const merchantOrderId = newOrderId();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";

  try {
    const token = await getAccessToken(config);
    const paymentResponse = await fetch(`${config.apiBase}/checkout/v2/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${token}`,
      },
      body: JSON.stringify({
        merchantOrderId,
        amount: total * 100,
        expireAfter: 1200,
        metaInfo: { udf1: "buzzora-web" },
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "Buzzora order payment",
          merchantUrls: { redirectUrl: `${siteUrl}/checkout` },
        },
      }),
      cache: "no-store",
    });
    const payment = await paymentResponse.json();
    const tokenUrl = payment.redirectUrl || payment.data?.redirectUrl;
    if (!paymentResponse.ok || !tokenUrl) {
      console.error("PhonePe payment request failed", paymentResponse.status, payment?.message || payment?.code);
      return NextResponse.json({ error: "Could not start PhonePe payment." }, { status: 502 });
    }

    return NextResponse.json({ merchantOrderId, tokenUrl });
  } catch (error) {
    console.error("PhonePe order creation failed", error);
    return NextResponse.json({ error: error.message || "Could not start PhonePe payment." }, { status: 502 });
  }
}
