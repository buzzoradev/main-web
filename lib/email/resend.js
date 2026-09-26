import { Resend } from "resend";

// Strictly server-only
if (typeof window !== "undefined") {
  throw new Error("lib/email/resend.js cannot be imported in client-side code.");
}

let resendInstance = null;

/**
 * Returns the default sender address for Buzzora transactional emails.
 * Uses the verified custom domain in production.
 */
export function getDefaultFromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || "Buzzora <orders@buzzora.co.in>";
}

/**
 * Returns the configured Reply-To address for customer replies.
 * Reads from process.env.RESEND_REPLY_TO, or null if not configured.
 */
export function getDefaultReplyToEmail() {
  return process.env.RESEND_REPLY_TO?.trim() || null;
}

/**
 * Resolves the configured Resend client.
 * Returns null if RESEND_API_KEY is not configured on the server.
 */
export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }

  return resendInstance;
}
