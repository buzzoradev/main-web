import { formatPrice, products } from "./products.js";

export function newOrderId() {
  return `BZ-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

// Build a fully-priced order object from cart items + customer, recomputing
// every line from the product catalogue.
export function buildOrder(cartItems, customer, { paymentMethod = "manual", id } = {}) {
  const lines = cartItems
    .map((i) => {
      const product = products.find((p) => p.id === i.productId);
      const size = product?.sizes.find((s) => s.sku === i.sizeSku);
      if (!product || !size) return null;
      return {
        name: product.name,
        weight: size.weight,
        sku: size.sku,
        qty: i.qty,
        unitPrice: size.price,
        lineTotal: size.price * i.qty,
      };
    })
    .filter(Boolean);

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shipping = 0; // PLACEHOLDER: set real shipping rules before launch.

  return {
    id: id || newOrderId(),
    status: "pending-confirmation",
    paymentMethod,
    customer: {
      name: (customer.name || "").trim(),
      email: (customer.email || "").trim(),
      phone: (customer.phone || "").trim(),
    },
    lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    createdAt: new Date().toISOString(),
  };
}

// Format an order as a human-readable WhatsApp message.
export function orderToWhatsAppText(order, customer) {
  const lines = order.lines
    .map((l) => `• ${l.name} (${l.weight}) × ${l.qty} — ${formatPrice(l.lineTotal)}`)
    .join("\n");
  return [
    "*New Buzzora order* 🍯",
    `Order: ${order.id}`,
    "",
    lines,
    "",
    `Subtotal: ${formatPrice(order.subtotal)}`,
    `Total: ${formatPrice(order.total)}`,
    "",
    "*Ship to*",
    customer.name,
    `${customer.address}, ${customer.city}, ${customer.state} ${customer.postcode}`,
    customer.country,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
  ].join("\n");
}

export function whatsAppUrl(number, message) {
  const digits = (number || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// mailto: fallback so an order can be emailed with no backend at all.
export function orderMailto(email, order, customer) {
  const body = orderToWhatsAppText(order, customer).replace(/\*/g, "");
  return `mailto:${email}?subject=${encodeURIComponent(
    `New Buzzora order ${order.id}`
  )}&body=${encodeURIComponent(body)}`;
}

// Canonical order fulfillment stages for timeline rendering
export const ORDER_STAGES = [
  { id: "CONFIRMED", label: "Order Confirmed", desc: "Your order has been received and verified." },
  { id: "PROCESSING", label: "Processing", desc: "We are carefully packing your pure raw honey." },
  { id: "SHIPPED", label: "Shipped", desc: "Your package is on its way with our courier partner." },
  { id: "DELIVERED", label: "Delivered", desc: "Package successfully delivered." },
];

/**
 * Builds an order progress timeline adhering strictly to Buzzora fulfillment state semantics.
 * - PENDING: None completed (awaiting payment confirmation)
 * - CONFIRMED: Stage 0 completed / current
 * - PROCESSING: Stages 0 & 1 completed, Stage 1 current
 * - SHIPPED: Stages 0, 1 & 2 completed, Stage 2 current
 * - DELIVERED: All 4 stages completed
 * - CANCELLED: None completed, distinct cancelled state
 */
export function buildOrderTimeline(status) {
  const normalized = (status || "PENDING").toUpperCase();
  let currentStageIndex = -1;

  if (normalized === "CONFIRMED") {
    currentStageIndex = 0;
  } else if (normalized === "PROCESSING") {
    currentStageIndex = 1;
  } else if (normalized === "SHIPPED") {
    currentStageIndex = 2;
  } else if (normalized === "DELIVERED") {
    currentStageIndex = 3;
  }

  return ORDER_STAGES.map((stage, i) => ({
    ...stage,
    completed: normalized !== "CANCELLED" && currentStageIndex >= 0 && i <= currentStageIndex,
    current: normalized !== "CANCELLED" && currentStageIndex >= 0 && i === currentStageIndex,
  }));
}

