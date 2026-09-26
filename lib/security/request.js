import crypto from "crypto";

/**
 * Reads and bounds JSON request payloads.
 * Protects against memory exhaustion, DoS, and unbounded payload attacks.
 *
 * @param {Request} request - Standard Next.js / Fetch Request
 * @param {Object} [options]
 * @param {number} [options.maxBytes=32768] - Maximum payload size (defaults to 32KB)
 * @returns {Promise<Object>} Parsed JSON payload
 */
export async function readBoundedJson(request, options = {}) {
  const maxBytes = options.maxBytes || 32 * 1024; // 32KB default

  // 1. Fast Content-Length header verification
  const contentLengthHeader =
    request.headers?.get?.("content-length") || request.headers?.["content-length"];
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      const error = new Error(`Request payload exceeds limit of ${maxBytes} bytes.`);
      error.statusCode = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
  }

  // 2. Read raw text
  let rawText;
  try {
    rawText = await request.text();
  } catch (err) {
    const error = new Error("Could not read request body.");
    error.statusCode = 400;
    error.code = "BODY_READ_ERROR";
    throw error;
  }

  // 3. Verify actual byte length (guards against missing or forged Content-Length)
  const actualBytes = Buffer.byteLength(rawText, "utf8");
  if (actualBytes > maxBytes) {
    const error = new Error(`Request payload (${actualBytes} bytes) exceeds limit of ${maxBytes} bytes.`);
    error.statusCode = 413;
    error.code = "PAYLOAD_TOO_LARGE";
    throw error;
  }

  if (!rawText || !rawText.trim()) {
    return {};
  }

  // 4. Safe JSON parsing
  try {
    return JSON.parse(rawText);
  } catch {
    const error = new Error("Malformed JSON request body.");
    error.statusCode = 400;
    error.code = "MALFORMED_JSON";
    throw error;
  }
}

/**
 * Reads and bounds raw text request bodies (e.g. for HMAC-verified webhooks).
 *
 * @param {Request} request
 * @param {Object} [options]
 * @param {number} [options.maxBytes=131072] - Maximum bytes (default 128KB)
 * @returns {Promise<string>} Raw text body
 */
export async function readBoundedText(request, options = {}) {
  const maxBytes = options.maxBytes || 128 * 1024; // 128KB default

  const contentLengthHeader =
    request.headers?.get?.("content-length") || request.headers?.["content-length"];
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      const error = new Error(`Request payload exceeds limit of ${maxBytes} bytes.`);
      error.statusCode = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
  }

  let rawText;
  try {
    rawText = await request.text();
  } catch (err) {
    const error = new Error("Could not read request body.");
    error.statusCode = 400;
    error.code = "BODY_READ_ERROR";
    throw error;
  }

  const actualBytes = Buffer.byteLength(rawText, "utf8");
  if (actualBytes > maxBytes) {
    const error = new Error(`Request payload (${actualBytes} bytes) exceeds limit of ${maxBytes} bytes.`);
    error.statusCode = 413;
    error.code = "PAYLOAD_TOO_LARGE";
    throw error;
  }

  return rawText;
}

/**
 * Validates UUIDv4 format.
 */
export function isValidUUID(id) {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * Validates Buzzora Order ID format (e.g. "BZ-LVT26K1L-X9A1").
 */
export function isValidOrderId(id) {
  if (!id || typeof id !== "string") return false;
  const clean = id.trim();
  return clean.length >= 6 && clean.length <= 50 && /^BZ-[A-Z0-9-]+$/i.test(clean);
}

/**
 * Sanitizes and normalizes an email address.
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase().slice(0, 255);
}

/**
 * Constant-time string comparison to resist timing attacks.
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
