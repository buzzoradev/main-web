import crypto from "crypto";

const SECRET =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.PHONEPE_WEBHOOK_SECRET ||
  "buzzora_secure_order_verification_secret_key_2026";

/**
 * Generate a deterministic HMAC token to authorize access to an order.
 * @param {string} buzzoraOrderId - e.g. "BZ-LVT26K1L-X9A1"
 * @param {string} customerEmail - e.g. "customer@example.com"
 * @returns {string} Hex HMAC verification token
 */
export function generateOrderVerificationToken(buzzoraOrderId, customerEmail) {
  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string") return "";
  const normalizedId = buzzoraOrderId.trim().toUpperCase();
  const normalizedEmail = (customerEmail || "").trim().toLowerCase();
  const payload = `${normalizedId}:${normalizedEmail}`;
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
}

/**
 * Verify if a provided verification token matches the expected token for an order.
 * @param {string} buzzoraOrderId
 * @param {string} customerEmail
 * @param {string} token
 * @returns {boolean}
 */
export function verifyOrderToken(buzzoraOrderId, customerEmail, token) {
  if (!token || typeof token !== "string") return false;
  const expectedToken = generateOrderVerificationToken(buzzoraOrderId, customerEmail);
  if (token.length !== expectedToken.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  } catch {
    return false;
  }
}
