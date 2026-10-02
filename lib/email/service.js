import { createServerSupabaseClient } from "../supabase/server.js";
import { getResendClient, getDefaultFromEmail, getDefaultReplyToEmail } from "./resend.js";
import { renderOrderConfirmationHtml } from "./templates/order-confirmation.js";
import { renderOrderShippedHtml } from "./templates/order-shipped.js";
import { renderOrderDeliveredHtml } from "./templates/order-delivered.js";
import { normalizeEmail } from "../security/request.js";
import { products } from "../products.js";

// Strictly server-only
if (typeof window !== "undefined") {
  throw new Error("lib/email/service.js cannot be imported in client-side code.");
}

export const EMAIL_EVENT_TYPES = {
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_SHIPPED: "ORDER_SHIPPED",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
};

export const EMAIL_EVENT_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
};

export const CANONICAL_SITE_URL = "https://www.buzzora.co.in";

/**
 * Resolves the public canonical HTTPS product image URL for an order item.
 * Strictly uses existing Buzzora product image assets without guessing.
 */
export function resolveProductImageUrl(item) {
  if (item?.imageUrl && /^https?:\/\//i.test(item.imageUrl)) {
    return item.imageUrl;
  }
  const sku = item?.size_sku || item?.sizeSku || item?.sku || "";
  const name = item?.product_name || item?.productName || item?.name || "";
  const weight = item?.weight || "";

  // 1. Match SKU in local catalog
  if (Array.isArray(products)) {
    for (const p of products) {
      const matchedSize = p.sizes?.find((s) => s.sku === sku);
      if (matchedSize?.image) {
        return `${CANONICAL_SITE_URL}${encodeURI(matchedSize.image)}`;
      }
    }
    // 2. Match Name + Weight
    for (const p of products) {
      if (name && p.name && (p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()))) {
        const matchedSize = p.sizes?.find((s) => s.weight === weight);
        if (matchedSize?.image) {
          return `${CANONICAL_SITE_URL}${encodeURI(matchedSize.image)}`;
        }
      }
    }
  }

  // 3. Known canonical image paths for existing live and historical Buzzora products
  if (sku === "BZ-SL-140" || (weight === "140g" && /sulai/i.test(name))) {
    return `${CANONICAL_SITE_URL}/product%20images/sulai%20140g.png`;
  }
  if (sku === "BZ-SL-250" || (weight === "250g" && /sulai/i.test(name))) {
    return `${CANONICAL_SITE_URL}/product%20images/sulai%20250g.png`;
  }
  if (sku === "BZ-SL-200" || (weight === "200g" && /sulai/i.test(name))) {
    return `${CANONICAL_SITE_URL}/product%20images/sulai%20200g.png`;
  }
  if (sku === "BZ-SL-500" || (weight === "500g" && /sulai/i.test(name))) {
    return `${CANONICAL_SITE_URL}/product%20images/sulai%20500g.png`;
  }
  if (/tulsi/i.test(name)) {
    return `${CANONICAL_SITE_URL}/product%20images/wild%20tulsi.png`;
  }

  // 4. Generic product image fallback
  if (Array.isArray(products)) {
    for (const p of products) {
      if (name && p.name && (p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()))) {
        if (p.image) {
          return `${CANONICAL_SITE_URL}${encodeURI(p.image)}`;
        }
      }
    }
  }

  return null;
}

/**
 * Sends the transactional Order Confirmation email following verified payment.
 *
 * Rules:
 * - Completely server-authoritative (reads customer and financial data directly from DB).
 * - Two-tier idempotency: DB unique constraint + Resend idempotency key.
 * - Non-blocking: failures are safely logged and recorded in order_email_events,
 *   never mutating or failing the order or payment state.
 *
 * @param {Object} params
 * @param {string} [params.orderId] - Internal UUID of the order
 * @param {string} [params.buzzoraOrderId] - Public Buzzora Order ID (e.g. BZ-XXXX)
 * @returns {Promise<Object>} Execution result model
 */
export async function sendOrderConfirmationEmail({ orderId, buzzoraOrderId }) {
  const supabase = createServerSupabaseClient();

  // 1. Fetch Authoritative Order Data
  let query = supabase.from("orders").select("id, buzzora_order_id, status, customer_name, customer_email, subtotal, shipping_cost, total, currency, shipping_address, city, state, postcode, country");
  if (orderId) {
    query = query.eq("id", orderId);
  } else if (buzzoraOrderId) {
    query = query.eq("buzzora_order_id", buzzoraOrderId.trim().toUpperCase());
  } else {
    return { success: false, error: "Neither orderId nor buzzoraOrderId provided." };
  }

  const { data: order, error: orderErr } = await query.single();
  if (orderErr || !order) {
    console.error("[EmailService] Order not found for confirmation email:", orderErr?.message);
    return { success: false, error: "Order not found." };
  }

  const cleanRecipient = normalizeEmail(order.customer_email);
  if (!cleanRecipient || !cleanRecipient.includes("@")) {
    console.warn(`[EmailService] Invalid recipient email for order ${order.buzzora_order_id}`);
    return { success: false, error: "Invalid recipient email address." };
  }

  // 2. Fetch Order Line Items
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  const enrichedItems = (items || []).map((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unit_price || item.unitPrice || 0);
    const lineTotal = Number(item.line_total || item.lineTotal || (unitPrice * qty));
    return {
      productName: item.product_name || item.productName || item.name,
      sizeSku: item.size_sku || item.sizeSku || item.sku,
      weight: item.weight,
      quantity: qty,
      unitPrice,
      lineTotal,
      imageUrl: resolveProductImageUrl(item),
    };
  });

  // 3. Establish Stable Idempotency Key
  const eventType = EMAIL_EVENT_TYPES.ORDER_CONFIRMED;
  const idempotencyKey = `order-confirmation/${order.buzzora_order_id}`;

  // 4. Claim / Record Event in Database (Tier 1 Idempotency)
  let eventRecord = null;
  try {
    const { data: existingEvent } = await supabase
      .from("order_email_events")
      .select("id, status, attempt_count, resend_email_id")
      .eq("order_id", order.id)
      .eq("event_type", eventType)
      .single();

    if (existingEvent) {
      if (existingEvent.status === EMAIL_EVENT_STATUS.SENT) {
        return {
          success: true,
          isIdempotent: true,
          status: EMAIL_EVENT_STATUS.SENT,
          resendEmailId: existingEvent.resend_email_id,
          message: "Order confirmation email already sent.",
        };
      }
      // If claimed as PENDING within the last 60 seconds, concurrent dispatch is already active
      const ageMs = Date.now() - new Date(existingEvent.created_at || existingEvent.updated_at || 0).getTime();
      if (existingEvent.status === EMAIL_EVENT_STATUS.PENDING && ageMs < 60000) {
        return {
          success: true,
          isIdempotent: true,
          status: EMAIL_EVENT_STATUS.PENDING,
          message: "Order confirmation email dispatch is already in progress.",
        };
      }
      eventRecord = existingEvent;
    } else {
      const { data: newEvent, error: insertErr } = await supabase
        .from("order_email_events")
        .insert({
          order_id: order.id,
          event_type: eventType,
          status: EMAIL_EVENT_STATUS.PENDING,
          recipient_email: cleanRecipient,
          idempotency_key: idempotencyKey,
          attempt_count: 0,
        })
        .select()
        .single();

      if (insertErr) {
        // Unique constraint violation from concurrent worker
        const { data: claimedEvent } = await supabase
          .from("order_email_events")
          .select("id, status, attempt_count, resend_email_id, created_at, updated_at")
          .eq("order_id", order.id)
          .eq("event_type", eventType)
          .single();

        if (claimedEvent) {
          if (claimedEvent.status === EMAIL_EVENT_STATUS.SENT) {
            return {
              success: true,
              isIdempotent: true,
              status: EMAIL_EVENT_STATUS.SENT,
              resendEmailId: claimedEvent.resend_email_id,
              message: "Order confirmation email already sent.",
            };
          }
          return {
            success: true,
            isIdempotent: true,
            status: claimedEvent.status,
            message: "Order confirmation email already claimed by concurrent operation.",
          };
        }
      } else if (newEvent) {
        eventRecord = newEvent;
      }
    }
  } catch (dbErr) {
    // If table not migrated yet, log warning and continue without crashing
    console.warn("[EmailService] DB order_email_events check warning:", dbErr.message);
  }

  // 5. Render Branded HTML Template
  const emailHtml = renderOrderConfirmationHtml({
    customerName: order.customer_name,
    buzzoraOrderId: order.buzzora_order_id,
    items: enrichedItems,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shipping_cost || 0),
    couponCode: order.coupon_code || null,
    couponDiscountAmount: Number(order.coupon_discount_amount || 0),
    couponDiscountPercent: order.coupon_discount_percent ? Number(order.coupon_discount_percent) : null,
    total: Number(order.total),
    currency: order.currency || "INR",
    shippingAddress: {
      address: order.shipping_address,
      city: order.city,
      state: order.state,
      postcode: order.postcode,
      country: order.country,
    },
    supportEmail: "orders@buzzora.co.in",
    siteUrl: CANONICAL_SITE_URL,
  });

  // 6. Check Resend Client Configuration
  const resend = getResendClient();
  const fromEmail = getDefaultFromEmail();
  const replyTo = getDefaultReplyToEmail();

  if (!resend) {
    console.info(`[EmailService Simulated]: RESEND_API_KEY is not configured on server. Order confirmation email for '${order.buzzora_order_id}' logged as SIMULATED.`);
    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.PENDING,
          last_error: "RESEND_API_KEY not configured on server",
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventRecord.id);
    }
    return {
      success: true,
      simulated: true,
      message: "Resend API key not configured; delivery skipped safely.",
    };
  }

  // 7. Dispatch via Resend API (Tier 2 Idempotency: official Idempotency-Key option)
  try {
    const emailPayload = {
      from: fromEmail,
      to: [cleanRecipient],
      subject: `Order Confirmed: ${order.buzzora_order_id} — Buzzora`,
      html: emailHtml,
      ...(replyTo ? { replyTo } : {}),
    };

    const { data: resendData, error: resendErr } = await resend.emails.send(
      emailPayload,
      {
        idempotencyKey,
      }
    );

    if (resendErr) {
      throw new Error(resendErr.message || "Resend API rejected transmission.");
    }

    const resendEmailId = resendData?.id || null;
    const nowIso = new Date().toISOString();

    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.SENT,
          resend_email_id: resendEmailId,
          sent_at: nowIso,
          attempt_count: (eventRecord.attempt_count || 0) + 1,
          last_error: null,
          updated_at: nowIso,
        })
        .eq("id", eventRecord.id);
    }

    console.log(`[EmailService]: Order confirmation email successfully sent to '${cleanRecipient}' (Resend ID: ${resendEmailId}).`);
    return {
      success: true,
      status: EMAIL_EVENT_STATUS.SENT,
      resendEmailId,
    };
  } catch (sendErr) {
    console.error(`[EmailService Error]: Failed to send confirmation email for '${order.buzzora_order_id}':`, sendErr.message);

    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.FAILED,
          last_error: sendErr.message?.slice(0, 300) || "Unknown Resend error",
          attempt_count: (eventRecord.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventRecord.id);
    }

    // Fail safe: return status without throwing
    return {
      success: false,
      status: EMAIL_EVENT_STATUS.FAILED,
      error: sendErr.message,
    };
  }
}

/**
 * Sends the transactional Order Shipped email when fulfillment details are assigned.
 *
 * @param {Object} params
 * @param {string} [params.orderId] - Internal UUID of the order
 * @param {string} [params.buzzoraOrderId] - Public Buzzora Order ID
 * @returns {Promise<Object>} Execution result model
 */
export async function sendOrderShippedEmail({ orderId, buzzoraOrderId }) {
  const supabase = createServerSupabaseClient();

  // 1. Fetch Authoritative Order Data
  let query = supabase
    .from("orders")
    .select("id, buzzora_order_id, status, customer_name, customer_email, total, currency, shipping_address, city, state, postcode, country, courier_name, tracking_number, tracking_url");
  if (orderId) {
    query = query.eq("id", orderId);
  } else if (buzzoraOrderId) {
    query = query.eq("buzzora_order_id", buzzoraOrderId.trim().toUpperCase());
  } else {
    return { success: false, error: "Neither orderId nor buzzoraOrderId provided." };
  }

  const { data: order, error: orderErr } = await query.single();
  if (orderErr || !order) {
    console.error("[EmailService] Order not found for shipping email:", orderErr?.message);
    return { success: false, error: "Order not found." };
  }

  const cleanRecipient = normalizeEmail(order.customer_email);
  if (!cleanRecipient || !cleanRecipient.includes("@")) {
    return { success: false, error: "Invalid recipient email address." };
  }

  // 1b. Fetch Order Line Items
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  const enrichedItems = (items || []).map((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unit_price || item.unitPrice || 0);
    const lineTotal = Number(item.line_total || item.lineTotal || unitPrice * qty);
    return {
      productName: item.product_name || item.productName || item.name,
      sizeSku: item.size_sku || item.sizeSku || item.sku,
      weight: item.weight,
      quantity: qty,
      unitPrice,
      lineTotal,
      imageUrl: resolveProductImageUrl(item),
    };
  });

  // 2. Establish Stable Idempotency Key
  const eventType = EMAIL_EVENT_TYPES.ORDER_SHIPPED;
  const idempotencyKey = `order-shipped/${order.buzzora_order_id}`;

  // 3. Claim / Record Event in Database
  let eventRecord = null;
  try {
    const { data: existingEvent } = await supabase
      .from("order_email_events")
      .select("id, status, attempt_count, resend_email_id")
      .eq("order_id", order.id)
      .eq("event_type", eventType)
      .single();

    if (existingEvent) {
      if (existingEvent.status === EMAIL_EVENT_STATUS.SENT) {
        return {
          success: true,
          isIdempotent: true,
          status: EMAIL_EVENT_STATUS.SENT,
          resendEmailId: existingEvent.resend_email_id,
          message: "Shipping email already sent.",
        };
      }
      // If claimed as PENDING within the last 60 seconds, concurrent dispatch is already active
      const ageMs = Date.now() - new Date(existingEvent.created_at || existingEvent.updated_at || 0).getTime();
      if (existingEvent.status === EMAIL_EVENT_STATUS.PENDING && ageMs < 60000) {
        return {
          success: true,
          isIdempotent: true,
          status: EMAIL_EVENT_STATUS.PENDING,
          message: "Shipping email dispatch is already in progress.",
        };
      }
      eventRecord = existingEvent;
    } else {
      const { data: newEvent, error: insertErr } = await supabase
        .from("order_email_events")
        .insert({
          order_id: order.id,
          event_type: eventType,
          status: EMAIL_EVENT_STATUS.PENDING,
          recipient_email: cleanRecipient,
          idempotency_key: idempotencyKey,
          attempt_count: 0,
        })
        .select()
        .single();

      if (insertErr) {
        // Unique constraint violation from concurrent worker
        const { data: claimedEvent } = await supabase
          .from("order_email_events")
          .select("id, status, attempt_count, resend_email_id, created_at, updated_at")
          .eq("order_id", order.id)
          .eq("event_type", eventType)
          .single();

        if (claimedEvent) {
          if (claimedEvent.status === EMAIL_EVENT_STATUS.SENT) {
            return {
              success: true,
              isIdempotent: true,
              status: EMAIL_EVENT_STATUS.SENT,
              resendEmailId: claimedEvent.resend_email_id,
              message: "Shipping email already sent.",
            };
          }
          return {
            success: true,
            isIdempotent: true,
            status: claimedEvent.status,
            message: "Shipping email already claimed by concurrent operation.",
          };
        }
      } else if (newEvent) {
        eventRecord = newEvent;
      }
    }
  } catch (dbErr) {
    console.warn("[EmailService] DB order_email_events check warning:", dbErr.message);
  }

  // 4. Render HTML Template
  const emailHtml = renderOrderShippedHtml({
    customerName: order.customer_name,
    buzzoraOrderId: order.buzzora_order_id,
    courierName: order.courier_name,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    items: enrichedItems,
    total: Number(order.total),
    currency: order.currency || "INR",
    shippingAddress: {
      address: order.shipping_address,
      city: order.city,
      state: order.state,
      postcode: order.postcode,
      country: order.country,
    },
    supportEmail: "orders@buzzora.co.in",
    siteUrl: CANONICAL_SITE_URL,
  });

  const resend = getResendClient();
  const fromEmail = getDefaultFromEmail();
  const replyTo = getDefaultReplyToEmail();

  if (!resend) {
    console.info(`[EmailService Simulated]: RESEND_API_KEY not configured. Shipping email for '${order.buzzora_order_id}' logged as SIMULATED.`);
    return {
      success: true,
      simulated: true,
      message: "Resend API key not configured; delivery skipped safely.",
    };
  }

  // 5. Dispatch via Resend API (Tier 2 Idempotency: official Idempotency-Key option)
  try {
    const emailPayload = {
      from: fromEmail,
      to: [cleanRecipient],
      subject: `Your Buzzora Honey Has Shipped! (${order.buzzora_order_id})`,
      html: emailHtml,
      ...(replyTo ? { replyTo } : {}),
    };

    const { data: resendData, error: resendErr } = await resend.emails.send(
      emailPayload,
      {
        idempotencyKey,
      }
    );

    if (resendErr) {
      throw new Error(resendErr.message || "Resend API rejected transmission.");
    }

    const resendEmailId = resendData?.id || null;
    const nowIso = new Date().toISOString();

    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.SENT,
          resend_email_id: resendEmailId,
          sent_at: nowIso,
          attempt_count: (eventRecord.attempt_count || 0) + 1,
          last_error: null,
          updated_at: nowIso,
        })
        .eq("id", eventRecord.id);
    }

    console.log(`[EmailService]: Shipping email successfully sent to '${cleanRecipient}' (Resend ID: ${resendEmailId}).`);
    return {
      success: true,
      status: EMAIL_EVENT_STATUS.SENT,
      resendEmailId,
    };
  } catch (sendErr) {
    console.error(`[EmailService Error]: Failed to send shipping email for '${order.buzzora_order_id}':`, sendErr.message);

    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.FAILED,
          last_error: sendErr.message?.slice(0, 300) || "Unknown Resend error",
          attempt_count: (eventRecord.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventRecord.id);
    }

    return {
      success: false,
      status: EMAIL_EVENT_STATUS.FAILED,
      error: sendErr.message,
    };
  }
}

/**
 * Sends the transactional Order Delivered email when order status transitions to DELIVERED.
 *
 * @param {Object} params
 * @param {string} [params.orderId] - Internal UUID of the order
 * @param {string} [params.buzzoraOrderId] - Public Buzzora Order ID
 * @returns {Promise<Object>} Execution result model
 */
export async function sendOrderDeliveredEmail({ orderId, buzzoraOrderId }) {
  const supabase = createServerSupabaseClient();

  // 1. Fetch Authoritative Order Data
  let query = supabase
    .from("orders")
    .select("id, buzzora_order_id, status, customer_name, customer_email, total, currency, shipping_address, city, state, postcode, country, courier_name, tracking_number, tracking_url");
  if (orderId) {
    query = query.eq("id", orderId);
  } else if (buzzoraOrderId) {
    query = query.eq("buzzora_order_id", buzzoraOrderId.trim().toUpperCase());
  } else {
    return { success: false, error: "Neither orderId nor buzzoraOrderId provided." };
  }

  const { data: order, error: orderErr } = await query.single();
  if (orderErr || !order) {
    console.error("[EmailService] Order not found for delivery email:", orderErr?.message);
    return { success: false, error: "Order not found." };
  }

  const cleanRecipient = normalizeEmail(order.customer_email);
  if (!cleanRecipient || !cleanRecipient.includes("@")) {
    return { success: false, error: "Invalid recipient email address." };
  }

  // 1b. Fetch Order Line Items
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, size_sku, weight, quantity, unit_price, line_total")
    .eq("order_id", order.id);

  const enrichedItems = (items || []).map((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unit_price || item.unitPrice || 0);
    const lineTotal = Number(item.line_total || item.lineTotal || unitPrice * qty);
    return {
      productName: item.product_name || item.productName || item.name,
      sizeSku: item.size_sku || item.sizeSku || item.sku,
      weight: item.weight,
      quantity: qty,
      unitPrice,
      lineTotal,
      imageUrl: resolveProductImageUrl(item),
    };
  });

  // 2. Establish Stable Idempotency Key
  const eventType = EMAIL_EVENT_TYPES.ORDER_DELIVERED;
  const idempotencyKey = `order-delivered/${order.buzzora_order_id}`;

  // 3. Claim / Record Event in Database
  let eventRecord = null;
  try {
    const { data: existingEvent } = await supabase
      .from("order_email_events")
      .select("id, status, attempt_count, resend_email_id")
      .eq("order_id", order.id)
      .eq("event_type", eventType)
      .single();

    if (existingEvent) {
      if (existingEvent.status === EMAIL_EVENT_STATUS.SENT) {
        return {
          success: true,
          isIdempotent: true,
          status: EMAIL_EVENT_STATUS.SENT,
          resendEmailId: existingEvent.resend_email_id,
          message: "Delivery email already sent.",
        };
      }
      const ageMs = Date.now() - new Date(existingEvent.created_at || existingEvent.updated_at || 0).getTime();
      if (existingEvent.status === EMAIL_EVENT_STATUS.PENDING && ageMs < 60000) {
        return {
          success: true,
          isIdempotent: true,
          status: EMAIL_EVENT_STATUS.PENDING,
          message: "Delivery email dispatch is already in progress.",
        };
      }
      eventRecord = existingEvent;
    } else {
      const { data: newEvent, error: insertErr } = await supabase
        .from("order_email_events")
        .insert({
          order_id: order.id,
          event_type: eventType,
          status: EMAIL_EVENT_STATUS.PENDING,
          recipient_email: cleanRecipient,
          idempotency_key: idempotencyKey,
          attempt_count: 0,
        })
        .select()
        .single();

      if (insertErr) {
        const { data: claimedEvent } = await supabase
          .from("order_email_events")
          .select("id, status, attempt_count, resend_email_id, created_at, updated_at")
          .eq("order_id", order.id)
          .eq("event_type", eventType)
          .single();

        if (claimedEvent) {
          if (claimedEvent.status === EMAIL_EVENT_STATUS.SENT) {
            return {
              success: true,
              isIdempotent: true,
              status: EMAIL_EVENT_STATUS.SENT,
              resendEmailId: claimedEvent.resend_email_id,
              message: "Delivery email already sent.",
            };
          }
          return {
            success: true,
            isIdempotent: true,
            status: claimedEvent.status,
            message: "Delivery email already claimed by concurrent operation.",
          };
        }
      } else if (newEvent) {
        eventRecord = newEvent;
      }
    }
  } catch (dbErr) {
    console.warn("[EmailService] DB order_email_events check warning:", dbErr.message);
  }

  // 4. Render HTML Template
  const emailHtml = renderOrderDeliveredHtml({
    customerName: order.customer_name,
    buzzoraOrderId: order.buzzora_order_id,
    courierName: order.courier_name,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    items: enrichedItems,
    total: Number(order.total),
    currency: order.currency || "INR",
    shippingAddress: {
      address: order.shipping_address,
      city: order.city,
      state: order.state,
      postcode: order.postcode,
      country: order.country,
    },
    supportEmail: "orders@buzzora.co.in",
    siteUrl: CANONICAL_SITE_URL,
  });

  const resend = getResendClient();
  const fromEmail = getDefaultFromEmail();
  const replyTo = getDefaultReplyToEmail();

  if (!resend) {
    console.info(`[EmailService Simulated]: RESEND_API_KEY not configured. Delivery email for '${order.buzzora_order_id}' logged as SIMULATED.`);
    return {
      success: true,
      simulated: true,
      message: "Resend API key not configured; delivery skipped safely.",
    };
  }

  // 5. Dispatch via Resend API (Tier 2 Idempotency: official Idempotency-Key option)
  try {
    const emailPayload = {
      from: fromEmail,
      to: [cleanRecipient],
      subject: `Your Buzzora Order Has Been Delivered! (${order.buzzora_order_id})`,
      html: emailHtml,
      ...(replyTo ? { replyTo } : {}),
    };

    const { data: resendData, error: resendErr } = await resend.emails.send(
      emailPayload,
      {
        idempotencyKey,
      }
    );

    if (resendErr) {
      throw new Error(resendErr.message || "Resend API rejected transmission.");
    }

    const resendEmailId = resendData?.id || null;
    const nowIso = new Date().toISOString();

    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.SENT,
          resend_email_id: resendEmailId,
          sent_at: nowIso,
          attempt_count: (eventRecord.attempt_count || 0) + 1,
          last_error: null,
          updated_at: nowIso,
        })
        .eq("id", eventRecord.id);
    }

    console.log(`[EmailService]: Delivery email successfully sent to '${cleanRecipient}' (Resend ID: ${resendEmailId}).`);
    return {
      success: true,
      status: EMAIL_EVENT_STATUS.SENT,
      resendEmailId,
    };
  } catch (sendErr) {
    console.error(`[EmailService Error]: Failed to send delivery email for '${order.buzzora_order_id}':`, sendErr.message);

    if (eventRecord) {
      await supabase
        .from("order_email_events")
        .update({
          status: EMAIL_EVENT_STATUS.FAILED,
          last_error: sendErr.message?.slice(0, 300) || "Unknown Resend error",
          attempt_count: (eventRecord.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventRecord.id);
    }

    return {
      success: false,
      status: EMAIL_EVENT_STATUS.FAILED,
      error: sendErr.message,
    };
  }
}

/**
 * Retrieves all recorded email events for an order.
 * Strictly privileged server-side admin operation.
 */
export async function getOrderEmailEvents(orderId) {
  const supabase = createServerSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("order_email_events")
      .select("id, event_type, status, recipient_email, resend_email_id, attempt_count, last_error, sent_at, created_at, updated_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Retries sending an email event for an order.
 * Strictly called by authenticated admin actions.
 */
export async function retryEmailEvent({ orderId, buzzoraOrderId, eventType }) {
  if (eventType === EMAIL_EVENT_TYPES.ORDER_CONFIRMED) {
    return sendOrderConfirmationEmail({ orderId, buzzoraOrderId });
  }
  if (eventType === EMAIL_EVENT_TYPES.ORDER_SHIPPED) {
    return sendOrderShippedEmail({ orderId, buzzoraOrderId });
  }
  if (eventType === EMAIL_EVENT_TYPES.ORDER_DELIVERED) {
    return sendOrderDeliveredEmail({ orderId, buzzoraOrderId });
  }
  return { success: false, error: `Unsupported email event type: ${eventType}` };
}
