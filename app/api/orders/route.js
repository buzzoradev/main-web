import { NextResponse } from "next/server";
import { products } from "@/lib/products";

// Order creation endpoint.
//
// Prices are always recomputed server-side from the catalogue — the client's
// totals are never trusted. Payment is provider-agnostic: set PAYMENT_PROVIDER
// to "razorpay" or "stripe" and add keys in .env to enable online payment;
// until then orders are accepted as Cash on Delivery / manual confirmation.
// Real payment capture must be verified via provider webhooks before an order
// is marked paid — see README "Payments".

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { customer, items } = body || {};

  const required = ["name", "email", "phone", "address", "city", "state", "postcode", "country"];
  for (const field of required) {
    if (!customer?.[field] || typeof customer[field] !== "string" || !customer[field].trim()) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Rebuild and price every line from the server-side catalogue.
  const lines = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const size = product?.sizes.find((s) => s.sku === item.sizeSku);
    const qty = Number(item.qty);
    if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
    }
    if (!size.inStock) {
      return NextResponse.json({ error: `${product.name} (${size.weight}) is out of stock` }, { status: 400 });
    }
    lines.push({
      name: product.name,
      weight: size.weight,
      sku: size.sku,
      qty,
      unitPrice: size.price,
      lineTotal: size.price * qty,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shipping = 0; // PLACEHOLDER: set real shipping rules before launch.
  const total = subtotal + shipping;

  const orderId = `BZ-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  // NOTE: persistence (database) and payment-provider order creation plug in
  // here. Without a configured provider the order is returned as
  // "pending-confirmation" and should be reconciled manually by the business.
  const order = {
    id: orderId,
    status: "pending-confirmation",
    paymentMethod: process.env.PAYMENT_PROVIDER || "manual",
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      city: customer.city.trim(),
      state: customer.state.trim(),
    },
    lines,
    subtotal,
    shipping,
    total,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json({ order });
}
