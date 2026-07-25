import { NextResponse } from "next/server";
import { products, CURRENCY } from "@/lib/products";

// Creates a Razorpay order. The amount is computed server-side from the
// catalogue — the client only sends product ids, sizes and quantities.
// Uses Razorpay's REST API directly (Basic auth) so no extra dependency is
// needed. Enable by setting RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET.
export async function POST(request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  let subtotal = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const size = product?.sizes.find((s) => s.sku === item.sizeSku);
    const qty = Number(item.qty);
    if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }
    if (!size.inStock) {
      return NextResponse.json({ error: `${product.name} (${size.weight}) is out of stock.` }, { status: 400 });
    }
    subtotal += size.price * qty;
  }

  const shipping = 0; // PLACEHOLDER: match lib/order.js shipping rules.
  const total = subtotal + shipping;
  const receipt = `BZ-${Date.now().toString(36).toUpperCase()}`;

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
    },
    body: JSON.stringify({
      amount: total * 100, // paise
      currency: CURRENCY,
      receipt,
      notes: { source: "buzzora-web" },
    }),
  });

  const order = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: "Could not create the payment order." }, { status: 502 });
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    receipt,
  });
}
