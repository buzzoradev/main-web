/**
 * Renders an inline-styled, responsive HTML transactional email
 * for customer order confirmation after verified PhonePe payment.
 *
 * Implements Buzzora brand identity:
 * - Official logo mark & wordmark (Bee visiting daisy + BUZZORA.)
 * - Brand palette: Cream (#FBF7EF), Charcoal (#241C12), Honey Gold (#D99A34)
 * - Official brand tagline: "From hive to heart"
 * - Complete item snapshot: image, product name, weight, SKU, quantity, unit price, line total
 *
 * @param {Object} params
 * @param {string} params.customerName - Full name of the customer
 * @param {string} params.buzzoraOrderId - Order identifier (e.g. BZ-XXXXXXXX-XXXX)
 * @param {Array<Object>} params.items - List of line items from database order_items
 * @param {number} params.subtotal - Subtotal in INR
 * @param {number} params.shippingCost - Shipping cost in INR
 * @param {number} params.total - Authoritative total amount paid in INR
 * @param {string} params.currency - Currency code (e.g. INR)
 * @param {Object} params.shippingAddress - Delivery destination
 * @param {string} [params.supportEmail] - Customer care email address (default: orders@buzzora.co.in)
 * @param {string} [params.siteUrl] - Base website URL (canonical: https://www.buzzora.co.in)
 * @returns {string} Standalone HTML document string
 */
export function renderOrderConfirmationHtml({
  customerName,
  buzzoraOrderId,
  items = [],
  subtotal,
  shippingCost = 0,
  total,
  currency = "INR",
  shippingAddress = {},
  supportEmail = "orders@buzzora.co.in",
  siteUrl = "https://www.buzzora.co.in",
}) {
  const formattedTotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(total || 0);

  const formattedSubtotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(subtotal || total || 0);

  const formattedShipping =
    Number(shippingCost) === 0 ? "FREE" : `₹${Number(shippingCost).toLocaleString("en-IN")}`;

  const logoUrl = `${siteUrl.replace(/\/+$/, "")}/buzzora-logo.png`;

  const itemsHtml = (items || [])
    .map((item) => {
      const name = item.productName || item.product_name || item.name || "Sulai Honey";
      const sku = item.sizeSku || item.size_sku || item.sku || "";
      const weight = item.weight || "";
      const qty = item.quantity || item.qty || 1;
      const unitPrice = Number(item.unitPrice || item.unit_price || 0);
      const lineTotal = Number(item.lineTotal || item.line_total || (unitPrice * qty) || 0);
      const imageUrl = item.imageUrl || null;

      return `
      <tr>
        ${
          imageUrl
            ? `
        <td style="padding: 14px 12px 14px 0; border-bottom: 1px solid #f0ede6; width: 56px; vertical-align: middle;">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="56" height="56" style="display: block; width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid #ebe7df; background-color: #fbf7ef;" />
        </td>
        `
            : ""
        }
        <td style="padding: 14px 0; border-bottom: 1px solid #f0ede6; vertical-align: middle;">
          <div style="font-weight: 700; font-size: 14px; color: #241C12; line-height: 1.3;">${escapeHtml(name)}</div>
          <div style="font-size: 12px; color: #6B5F4C; margin-top: 3px;">
            ${weight ? `<span style="display: inline-block; background-color: #f4eddf; padding: 1px 6px; border-radius: 4px; font-weight: 600; color: #3A3023; margin-right: 6px;">${escapeHtml(weight)}</span>` : ""}
            ${sku ? `<span style="font-family: monospace; font-size: 11px; color: #8A5A1E;">${escapeHtml(sku)}</span>` : ""}
          </div>
          <div style="font-size: 12px; color: #6B5F4C; margin-top: 4px;">
            Qty: <strong>${qty}</strong> × ₹${unitPrice.toLocaleString("en-IN")}
          </div>
        </td>
        <td style="padding: 14px 0; border-bottom: 1px solid #f0ede6; text-align: right; vertical-align: middle; white-space: nowrap;">
          <div style="font-size: 15px; font-weight: 700; color: #241C12;">
            ₹${lineTotal.toLocaleString("en-IN")}
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed — Buzzora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FBF7EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBF7EF; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #EBE7DF; box-shadow: 0 4px 20px rgba(36, 28, 18, 0.05);">
          
          <!-- Official Brand Header -->
          <tr>
            <td style="background-color: #FBF7EF; padding: 32px 32px 24px 32px; border-bottom: 1px solid #EBE7DF; text-align: center;">
              <a href="${escapeHtml(siteUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
                <img src="${escapeHtml(logoUrl)}" alt="BUZZORA · From hive to heart" width="220" height="50" style="display: block; border: 0; outline: none; margin: 0 auto; max-width: 100%; height: auto;" />
              </a>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <div style="display: inline-block; background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 9999px; padding: 4px 14px; font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px;">
                ✓ Payment Received &amp; Order Confirmed
              </div>
              <h1 style="margin: 16px 0 8px 0; font-size: 22px; font-weight: 700; color: #241C12; line-height: 1.3;">
                Thank you, ${escapeHtml(customerName || "Friend")}!
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6B5F4C;">
                Your payment was successfully verified and your order has been placed. Our team is carefully preparing your jars of pure, raw honey.
              </p>
            </td>
          </tr>

          <!-- Order Summary Metadata Box -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background-color: #FBF7EF; border: 1px solid #EBE7DF; border-radius: 12px; padding: 16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 11px; color: #6B5F4C; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Order ID</td>
                    <td style="font-size: 11px; color: #6B5F4C; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; text-align: right;">Status</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; font-weight: 700; font-family: monospace; color: #241C12; padding-top: 4px;">
                      ${escapeHtml(buzzoraOrderId)}
                    </td>
                    <td style="font-size: 13px; font-weight: 700; color: #047857; text-align: right; padding-top: 4px;">
                      CONFIRMED
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Line Items Table -->
          <tr>
            <td style="padding: 0 32px 16px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6B5F4C;">
                Items Ordered
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Financial Calculation -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top: 8px;">
                <tr>
                  <td style="font-size: 13px; color: #6B5F4C; padding: 4px 0;">Subtotal</td>
                  <td style="font-size: 13px; color: #241C12; text-align: right; font-weight: 600; padding: 4px 0;">${formattedSubtotal}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #6B5F4C; padding: 4px 0;">Standard Shipping</td>
                  <td style="font-size: 13px; color: #047857; text-align: right; font-weight: 600; padding: 4px 0;">${formattedShipping}</td>
                </tr>
                <tr>
                  <td style="font-size: 16px; font-weight: 800; color: #241C12; padding: 12px 0 0 0; border-top: 2px solid #EBE7DF;">Total Paid</td>
                  <td style="font-size: 18px; font-weight: 800; color: #D99A34; text-align: right; padding: 12px 0 0 0; border-top: 2px solid #EBE7DF;">${formattedTotal}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Address & Next Steps -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="background-color: #FDF6E7; border: 1px solid #F5D68E; border-radius: 12px; padding: 16px 20px;">
                <h3 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8A5A1E;">
                  What Happens Next?
                </h3>
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #5F3D12;">
                  Your order is currently being prepared with care. As soon as your package is dispatched, we will send your <strong>tracking ID and courier partner details</strong> to this email address.
                </p>
                ${
                  shippingAddress?.address
                    ? `
                  <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #E8A82B; font-size: 12px; color: #5F3D12;">
                    <strong>Shipping To:</strong> ${escapeHtml(shippingAddress.address)}, ${escapeHtml(
                        shippingAddress.city || ""
                      )}, ${escapeHtml(shippingAddress.state || "")} ${escapeHtml(
                        shippingAddress.postcode || ""
                      )}${shippingAddress.country ? `, ${escapeHtml(shippingAddress.country)}` : ""}
                  </div>
                `
                    : ""
                }
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FBF7EF; padding: 24px 32px; border-top: 1px solid #EBE7DF; text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6B5F4C;">
                Questions about your order? Reply directly to this email or contact us at
                <a href="mailto:${escapeHtml(supportEmail)}" style="color: #D99A34; font-weight: 600; text-decoration: none;">${escapeHtml(supportEmail)}</a>.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #8A5A1E;">
                Buzzora · 100% Raw, Unprocessed Honey · From hive to heart · <a href="${escapeHtml(siteUrl)}" style="color: #6B5F4C; text-decoration: underline;">buzzora.co.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
