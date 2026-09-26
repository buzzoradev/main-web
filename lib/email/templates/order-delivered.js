/**
 * Renders an inline-styled, responsive HTML transactional email
 * for customer order delivery notification.
 *
 * Implements Buzzora brand identity:
 * - Official logo mark & wordmark (Bee visiting daisy + BUZZORA.)
 * - Brand palette: Cream (#FBF7EF), Charcoal (#241C12), Honey Gold (#D99A34), Emerald (#047857)
 * - Official brand tagline: "From hive to heart"
 * - Dynamic authoritative courier and tracking details
 * - Item snapshot: product name, weight, SKU, quantity, price, line total
 * - Delivery destination address
 *
 * @param {Object} params
 * @param {string} params.customerName - Full name of the customer
 * @param {string} params.buzzoraOrderId - Order identifier (e.g. BZ-XXXXXXXX-XXXX)
 * @param {string} [params.courierName] - Registered courier service name
 * @param {string} [params.trackingNumber] - Consignment / tracking number
 * @param {string} [params.trackingUrl] - Valid HTTPS live tracking link
 * @param {Array<Object>} [params.items] - Ordered line items
 * @param {number} [params.total] - Total order amount
 * @param {string} [params.currency] - Currency (default INR)
 * @param {Object} [params.shippingAddress] - Delivery destination
 * @param {string} [params.supportEmail] - Customer care email address (default: orders@buzzora.co.in)
 * @param {string} [params.siteUrl] - Base website URL (canonical: https://www.buzzora.co.in)
 * @returns {string} Standalone HTML document string
 */
export function renderOrderDeliveredHtml({
  customerName,
  buzzoraOrderId,
  courierName = null,
  trackingNumber = null,
  trackingUrl = null,
  items = [],
  total,
  currency = "INR",
  shippingAddress = {},
  supportEmail = "orders@buzzora.co.in",
  siteUrl = "https://www.buzzora.co.in",
}) {
  // Enforce HTTPS-only for tracking URL
  const safeTrackingUrl =
    trackingUrl && typeof trackingUrl === "string" && /^https:\/\//i.test(trackingUrl.trim())
      ? trackingUrl.trim()
      : null;

  const logoUrl = `${siteUrl.replace(/\/+$/, "")}/buzzora-logo.png`;

  const formattedTotal =
    total !== undefined && total !== null
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: currency || "INR",
          maximumFractionDigits: 0,
        }).format(total)
      : null;

  const itemsHtml = (items || [])
    .map((item) => {
      const name = item.productName || item.product_name || item.name || "Sulai Honey";
      const sku = item.sizeSku || item.size_sku || item.sku || "";
      const weight = item.weight || "";
      const qty = item.quantity || item.qty || 1;
      const unitPrice = Number(item.unitPrice || item.unit_price || 0);
      const lineTotal = Number(item.lineTotal || item.line_total || unitPrice * qty || 0);
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
  <title>Your Honey Has Been Delivered! — Buzzora</title>
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

          <!-- Delivery Banner -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <div style="display: inline-block; background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 9999px; padding: 4px 14px; font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px;">
                ✓ Package Delivered
              </div>
              <h1 style="margin: 16px 0 8px 0; font-size: 22px; font-weight: 700; color: #241C12; line-height: 1.3;">
                Your Honey Has Arrived, ${escapeHtml(customerName || "Friend")}!
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6B5F4C;">
                Great news! Your package for order <strong>${escapeHtml(buzzoraOrderId)}</strong> has been successfully delivered. We hope you enjoy the pure, natural goodness of your raw honey.
              </p>
            </td>
          </tr>

          ${
            courierName || trackingNumber
              ? `
          <!-- Delivery Details Box -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px; font-weight: 600;">Delivered By</td>
                    <td style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; text-align: right; padding-bottom: 4px; font-weight: 600;">Status</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; font-weight: 700; color: #0F172A; padding-bottom: 16px;">
                      ${escapeHtml(courierName || "Courier Partner")}
                    </td>
                    <td style="font-size: 13px; font-weight: 700; color: #047857; text-align: right; padding-bottom: 16px;">
                      DELIVERED
                    </td>
                  </tr>
                  ${
                    trackingNumber
                      ? `
                  <tr>
                    <td colspan="2" style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px; border-top: 1px dashed #CBD5E1; padding-top: 16px; font-weight: 600;">
                      Tracking / Waybill Number
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="font-size: 18px; font-weight: 800; font-family: monospace; color: #0F172A; letter-spacing: 1px;">
                      ${escapeHtml(trackingNumber)}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                </table>

                ${
                  safeTrackingUrl
                    ? `
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="${escapeHtml(safeTrackingUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #D99A34; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 9999px; box-shadow: 0 2px 8px rgba(217, 154, 52, 0.35);">
                      View Order &amp; Delivery Details →
                    </a>
                  </div>
                `
                    : ""
                }
              </div>
            </td>
          </tr>
          `
              : ""
          }

          ${
            itemsHtml
              ? `
          <!-- Items Delivered -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8A5A1E; margin-bottom: 8px;">
                Items Delivered
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                ${itemsHtml}
              </table>
              ${
                formattedTotal
                  ? `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0ede6; text-align: right; font-size: 14px; color: #241C12;">
                Total Paid: <strong>${escapeHtml(formattedTotal)}</strong>
              </div>
              `
                  : ""
              }
            </td>
          </tr>
          `
              : ""
          }

          <!-- Delivery Destination Address -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="background-color: #FDF6E7; border: 1px solid #F5D68E; border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #5F3D12;">
                  Thank you for welcoming Buzzora into your home. Each jar is harvested with utmost respect for nature and pure bee health.
                </p>
                ${
                  shippingAddress?.address
                    ? `
                  <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #E8A82B; font-size: 12px; color: #5F3D12;">
                    <strong>Delivered To:</strong> ${escapeHtml(shippingAddress.address)}${
                        shippingAddress.city ? `, ${escapeHtml(shippingAddress.city)}` : ""
                      }${shippingAddress.state ? `, ${escapeHtml(shippingAddress.state)}` : ""}${
                        shippingAddress.postcode ? ` ${escapeHtml(shippingAddress.postcode)}` : ""
                      }${shippingAddress.country ? `, ${escapeHtml(shippingAddress.country)}` : ""}
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
                Questions or feedback on your delivery? Reply directly to this email or write to
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
