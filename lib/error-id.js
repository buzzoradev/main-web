/**
 * Safe Error Reference ID Generator for Buzzora
 *
 * Generates an opaque, client-safe error reference identifier.
 * Format: BZ-ERR-XXXXXX (6 alphanumeric characters, unambiguous charset)
 *
 * Security:
 * - Contains ZERO user PII (no email, no phone, no names)
 * - Contains ZERO database IDs or table references
 * - Contains ZERO secrets or tokens
 * - Contains ZERO stack traces or system paths
 */

const SAFE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateErrorReferenceId() {
  let suffix = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i++) {
      suffix += SAFE_CHARSET[bytes[i] % SAFE_CHARSET.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      suffix += SAFE_CHARSET[Math.floor(Math.random() * SAFE_CHARSET.length)];
    }
  }
  return `BZ-ERR-${suffix}`;
}
