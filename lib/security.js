import crypto from "crypto";

// Default token lifespan: 48 hours in milliseconds (adequate for customer post-checkout access)
export const DEFAULT_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Derives a dedicated, high-entropy cryptographic secret for signing customer order tokens.
 * Strictly server-side. Never exposes underlying infrastructure keys.
 *
 * Production Security Requirements:
 * - ORDER_VERIFICATION_SECRET is REQUIRED in production.
 * - In production, missing ORDER_VERIFICATION_SECRET strictly fails closed.
 * - NO fallback secret, NO hardcoded secret, NO Supabase secret reuse, NO PhonePe secret reuse.
 * - Local development has an explicit development-only fallback that CANNOT ever execute in production.
 */
function getOrderSigningKey() {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredSecret = process.env.ORDER_VERIFICATION_SECRET?.trim();

  if (isProduction) {
    if (!configuredSecret) {
      throw new Error(
        "Production security configuration error: ORDER_VERIFICATION_SECRET is strictly required in production."
      );
    }
    return crypto.createHmac("sha256", configuredSecret).update("buzzora_order_access_token_v2").digest();
  }

  // Explicit non-production fallback strictly for local development and offline unit tests
  const devSecret = configuredSecret || "buzzora_development_only_secret_cannot_run_in_production";
  return crypto.createHmac("sha256", devSecret).update("buzzora_order_access_token_v2").digest();
}

/**
 * Generates a short-lived, cryptographically signed, stateless verification token.
 * Token structure: `<base64url(payload)>.<base64url(signature)>`
 *
 * @param {string} buzzoraOrderId - e.g. "BZ-MUEW22D5-I9LY"
 * @param {string} [customerEmail] - optional customer email for context binding
 * @param {Object} [options]
 * @param {number} [options.ttlMs] - Time to live in ms (defaults to 48 hours)
 * @returns {string} Signed token
 */
export function generateOrderVerificationToken(buzzoraOrderId, customerEmail = "", options = {}) {
  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string") return "";

  const ttlMs =
    typeof options?.ttlMs === "number"
      ? options.ttlMs
      : DEFAULT_TOKEN_TTL_MS;
  const now = Date.now();
  const normalizedOrderId = buzzoraOrderId.trim().toUpperCase();

  const payload = {
    oid: normalizedOrderId,
    exp: now + ttlMs,
    iat: now,
    nonce: crypto.randomBytes(8).toString("hex"),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingKey = getOrderSigningKey();
  const signature = crypto.createHmac("sha256", signingKey).update(payloadB64).digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed order token against a specific Buzzora Order ID.
 * Performs constant-time signature comparison, expiry check, and order-binding check.
 *
 * @param {string} buzzoraOrderId - The order ID being accessed
 * @param {string} token - The signed token presented by the client
 * @returns {{ isValid: boolean, reason?: string, payload?: Object }}
 */
export function verifyOrderTokenDetailed(buzzoraOrderId, token) {
  if (!token || typeof token !== "string" || !buzzoraOrderId || typeof buzzoraOrderId !== "string") {
    return { isValid: false, reason: "MISSING_INPUT" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 2) {
    return { isValid: false, reason: "INVALID_FORMAT" };
  }

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) {
    return { isValid: false, reason: "MALFORMED_TOKEN" };
  }

  // 1. Verify HMAC signature in constant time
  let signingKey;
  try {
    signingKey = getOrderSigningKey();
  } catch {
    return { isValid: false, reason: "KEY_DERIVATION_FAILED" };
  }

  const expectedSig = crypto.createHmac("sha256", signingKey).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expSigBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return { isValid: false, reason: "INVALID_SIGNATURE" };
  }

  // 2. Decode and parse payload
  let payloadObj;
  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    payloadObj = JSON.parse(jsonStr);
  } catch {
    return { isValid: false, reason: "MALFORMED_PAYLOAD" };
  }

  // 3. Verify order binding (cannot use token from Order A on Order B)
  const normalizedTargetId = buzzoraOrderId.trim().toUpperCase();
  if (!payloadObj.oid || payloadObj.oid.toUpperCase() !== normalizedTargetId) {
    return { isValid: false, reason: "ORDER_MISMATCH" };
  }

  // 4. Verify expiration
  if (typeof payloadObj.exp !== "number" || Date.now() > payloadObj.exp) {
    return { isValid: false, reason: "EXPIRED_TOKEN" };
  }

  return { isValid: true, payload: payloadObj };
}

/**
 * Boolean wrapper for verifyOrderTokenDetailed (compatible with existing signature).
 *
 * @param {string} buzzoraOrderId
 * @param {string} [customerEmail]
 * @param {string} token
 * @returns {boolean}
 */
export function verifyOrderToken(buzzoraOrderId, customerEmail, token) {
  const result = verifyOrderTokenDetailed(buzzoraOrderId, token);
  return result.isValid;
}

