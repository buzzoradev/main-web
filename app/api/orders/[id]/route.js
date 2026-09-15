import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  const buzzoraOrderId = params?.id;
  if (
    !buzzoraOrderId ||
    typeof buzzoraOrderId !== "string" ||
    !/^BZ-[A-Z0-9-]+$/i.test(buzzoraOrderId.trim())
  ) {
    return NextResponse.json({ error: "Invalid Buzzora Order ID format" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, buzzora_order_id, status, customer_name, customer_email, customer_phone, shipping_address, city, state, postcode, country, subtotal, shipping_cost, total, currency, created_at"
    )
    .eq("buzzora_order_id", buzzoraOrderId.trim())
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  if (itemsError) {
    return NextResponse.json({ error: "Could not load order line items" }, { status: 500 });
  }

  const lines = (items || []).map((i) => ({
    name: i.product_name,
    weight: i.weight,
    sku: i.size_sku,
    qty: i.quantity,
    unitPrice: Number(i.unit_price),
    lineTotal: Number(i.line_total),
  }));

  const safeOrder = {
    id: order.buzzora_order_id,
    status: order.status, // "PENDING", "CONFIRMED", etc.
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      address: order.shipping_address,
      city: order.city,
      state: order.state,
      postcode: order.postcode,
      country: order.country,
    },
    shippingAddress: {
      address: order.shipping_address,
      city: order.city,
      state: order.state,
      postcode: order.postcode,
      country: order.country,
    },
    lines,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping_cost),
    total: Number(order.total),
    currency: order.currency,
    createdAt: order.created_at,
  };

  return NextResponse.json({ order: safeOrder });
}
