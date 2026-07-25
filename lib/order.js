// Shared order helpers used by the checkout on both static (GitHub Pages) and
// server (Vercel) hosting. Prices are always taken from the catalogue, never
// from anything the client could tamper with in transit.
import { formatPrice, products } from "@/lib/products";

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
