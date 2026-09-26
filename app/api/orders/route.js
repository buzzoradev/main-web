import { NextResponse } from "next/server";
import { products } from "@/lib/products";
import { newOrderId } from "@/lib/order";
import { createOrderRecord } from "@/lib/db/orders";
import { generateOrderVerificationToken } from "@/lib/security";
import { orderCreateRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";
import { readBoundedJson, normalizeEmail } from "@/lib/security/request";

export async function POST(request) {
  // 1. Enforce rate limiting on public order creation (15 orders / 10 minutes per IP)
  const rateLimitResult = await orderCreateRateLimit(request);
  if (!rateLimitResult.success) {
    return rateLimitResponse(
      rateLimitResult,
      "Too many order creation requests. Please wait a few moments before trying again."
    );
  }

  // 2. Read bounded JSON body (max 64KB)
  let body;
  try {
    body = await readBoundedJson(request, { maxBytes: 64 * 1024 });
  } catch (err) {
    const status = err.statusCode || 400;
    return NextResponse.json({ error: err.message || "Invalid request body" }, { status });
  }

  const headerIdempotencyKey = request.headers.get("x-idempotency-key") || request.headers.get("idempotency-key");
  const { customer, items, orderId: clientOrderId, idempotencyKey: bodyIdempotencyKey } = body || {};
  const idempotencyKey = bodyIdempotencyKey || headerIdempotencyKey || null;

  // 3. Validate Customer Contact & Shipping Fields
  const required = ["name", "email", "phone", "address", "city", "state", "postcode", "country"];
  for (const field of required) {
    if (!customer?.[field] || typeof customer[field] !== "string" || !customer[field].trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const cleanCustomerEmail = normalizeEmail(customer.email);
  if (!cleanCustomerEmail.includes("@")) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }

  // 4. Validate Cart Items Array
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return NextResponse.json({ error: "Cart must contain between 1 and 50 items." }, { status: 400 });
  }

  // 5. Reconstruct lines & price totals strictly from server-side product catalog
  const lines = [];
  const itemsData = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const size = product?.sizes.find((s) => s.sku === item.sizeSku);
    const qty = Number(item.qty);

    if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }

    if (!size.inStock) {
      return NextResponse.json(
        { error: `${product.name} (${size.weight}) is out of stock` },
        { status: 400 }
      );
    }

    const unitPrice = size.price;
    const lineTotal = unitPrice * qty;

    lines.push({
      name: product.name,
      weight: size.weight,
      sku: size.sku,
      qty,
      unitPrice,
      lineTotal,
    });

    itemsData.push({
      product_id: product.id,
      product_name: product.name,
      size_sku: size.sku,
      weight: size.weight,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  // 6. Calculate Server-Side Financial Totals (INR)
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shippingCost = 0;
  const total = subtotal + shippingCost;

  // 7. Generate / Preserve Unique Public Buzzora Order ID (e.g. 'BZ-LVT26K1L-X9A1')
  const buzzoraOrderId = clientOrderId || newOrderId();

  // 8. Save Order & Items Atomically to Supabase PostgreSQL Database via RPC
  try {
    const dbResult = await createOrderRecord({
      orderData: {
        buzzora_order_id: buzzoraOrderId,
        customer_name: customer.name.trim(),
        customer_email: cleanCustomerEmail,
        customer_phone: customer.phone.trim(),
        shipping_address: customer.address.trim(),
        city: customer.city.trim(),
        state: customer.state.trim(),
        postcode: customer.postcode.trim(),
        country: customer.country.trim(),
        subtotal,
        shipping_cost: shippingCost,
        total,
      },
      itemsData,
      idempotencyKey,
    });

    // 9. Return Response Compatible with Existing Checkout UI
    const verificationToken = generateOrderVerificationToken(
      dbResult.buzzoraOrderId,
      cleanCustomerEmail
    );

    const orderResponse = {
      id: dbResult.buzzoraOrderId,
      status: "pending-confirmation",
      paymentMethod: process.env.PAYMENT_PROVIDER || "manual",
      verificationToken,
      customer: {
        name: customer.name.trim(),
        email: cleanCustomerEmail,
        phone: customer.phone.trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
        state: customer.state.trim(),
        postcode: customer.postcode.trim(),
        country: customer.country.trim(),
      },
      lines,
      subtotal,
      shipping: shippingCost,
      total,
      createdAt: dbResult.createdAt || new Date().toISOString(),
    };

    return NextResponse.json({ order: orderResponse });
  } catch (error) {
    console.error("[POST /api/orders Error]:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to create atomic order in database." },
      { status: 500 }
    );
  }
}
