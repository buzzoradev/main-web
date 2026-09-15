import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Persists an order and its line items atomically using Supabase PostgreSQL RPC (create_order_with_items).
 * Guarantees true database transaction safety (all-or-nothing) and server-side idempotency.
 */
export async function createOrderRecord({ orderData, itemsData, idempotencyKey }) {
  const supabase = createServerSupabaseClient();

  const rpcParams = {
    p_buzzora_order_id: orderData.buzzora_order_id,
    p_customer_name: orderData.customer_name,
    p_customer_email: orderData.customer_email,
    p_customer_phone: orderData.customer_phone,
    p_shipping_address: orderData.shipping_address,
    p_city: orderData.city,
    p_state: orderData.state,
    p_postcode: orderData.postcode,
    p_country: orderData.country || "India",
    p_subtotal: orderData.subtotal,
    p_shipping_cost: orderData.shipping_cost || 0,
    p_total: orderData.total,
    p_currency: "INR",
    p_items: itemsData,
    p_idempotency_key: idempotencyKey || null,
  };

  const { data, error } = await supabase.rpc("create_order_with_items", rpcParams);

  if (error) {
    console.error("[Database RPC create_order_with_items Error]:", error.message);
    throw new Error("Failed to save atomic order to database.");
  }

  return {
    orderId: data.order_id,
    buzzoraOrderId: data.buzzora_order_id,
    createdAt: data.created_at,
    isDuplicate: Boolean(data.is_duplicate),
  };
}
