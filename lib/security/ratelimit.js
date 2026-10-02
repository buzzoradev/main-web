/**
 * Distributed & Serverless-Compatible Rate Limiting Engine.
 *
 * Production Hardening Principles:
 * 1. Primary distributed backend: Upstash Redis REST API (when UPSTASH_REDIS_REST_URL
 *    and UPSTASH_REDIS_REST_TOKEN are set). Compatible with Vercel Serverless/Edge runtimes
 *    using native fetch with zero external npm dependencies.
 * 2. Production Fail-Closed Behavior on Sensitive Endpoints:
 *    - In production (NODE_ENV === "production"), sensitive endpoints (admin login,
 *      admin refresh, customer order tracking, order detail) MUST NOT silently degrade
 *      from distributed protection to per-instance memory limits (which could allow
 *      an attacker to bypass limits by distributing requests across serverless instances).
 *    - If Upstash is unconfigured or encounters an outage in production, sensitive endpoints
 *      fail closed with a safe retry window.
 * 3. Provider Webhook Resilience:
 *    - PhonePe webhooks do NOT fail closed on Redis outages to ensure legitimate provider
 *      payment notifications and retries are never blocked.
 *    - S2S HMAC SHA-256 signature verification remains the primary authoritative gatekeeper.
 * 4. Local Development:
 *    - Automatically falls back to an in-memory sliding window when NODE_ENV !== "production".
 */

// In-memory sliding window cache for local development & failover
const localWindowStore = new Map();
const MAX_LOCAL_ENTRIES = 5000;

/**
 * Extracts and sanitizes the client IP address from standard deployment headers.
 * Supports Vercel, Cloudflare, AWS CloudFront, and standard reverse proxies.
 *
 * @param {Request} request
 * @returns {string} Sanitized client IP
 */
export function getClientIp(request) {
  if (!request) return "127.0.0.1";

  const getHeader = (name) => {
    if (request.headers && typeof request.headers.get === "function") {
      return request.headers.get(name);
    }
    return request.headers?.[name] || request.headers?.[name.toLowerCase()];
  };

  // 1. x-forwarded-for (first IP is the real client)
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded && typeof forwarded === "string") {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp && isValidIp(firstIp)) {
      return firstIp;
    }
  }

  // 2. x-real-ip
  const realIp = getHeader("x-real-ip");
  if (realIp && typeof realIp === "string" && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  // 3. cf-connecting-ip (Cloudflare)
  const cfIp = getHeader("cf-connecting-ip");
  if (cfIp && typeof cfIp === "string" && isValidIp(cfIp.trim())) {
    return cfIp.trim();
  }

  return "127.0.0.1";
}

function isValidIp(ip) {
  // Basic sanity check against malicious header injection
  return /^[a-fA-F0-9:.]+$/.test(ip) && ip.length <= 45;
}

/**
 * Cleans expired entries from the local in-memory store to prevent unbounded memory growth.
 */
function cleanupLocalStore(now) {
  if (localWindowStore.size < MAX_LOCAL_ENTRIES) return;
  for (const [key, timestamps] of localWindowStore.entries()) {
    const active = timestamps.filter((t) => t > now);
    if (active.length === 0) {
      localWindowStore.delete(key);
    } else {
      localWindowStore.set(key, active);
    }
  }
}

/**
 * Executes an in-memory sliding window rate check.
 */
function checkLocalRateLimit(key, limit, windowSeconds) {
  const now = Date.now();
  cleanupLocalStore(now);

  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  const timestamps = (localWindowStore.get(key) || []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      resetInSeconds,
      isDistributed: false,
    };
  }

  timestamps.push(now);
  localWindowStore.set(key, timestamps);

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - timestamps.length),
    resetInSeconds: windowSeconds,
    isDistributed: false,
  };
}

/**
 * Executes a distributed atomic rate check via Upstash Redis REST pipeline.
 */
async function checkUpstashRateLimit(key, limit, windowSeconds, upstashUrl, upstashToken) {
  const redisKey = `bz_rl:${key}`;
  const cleanUrl = upstashUrl.replace(/\/$/, "");

  // Redis Pipeline: INCR key, then set EXPIRE if not already set (NX)
  const pipeline = [
    ["INCR", redisKey],
    ["EXPIRE", redisKey, windowSeconds, "NX"],
  ];

  const response = await fetch(`${cleanUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pipeline),
    signal: AbortSignal.timeout(2000), // 2s fast-fail timeout
  });

  if (!response.ok) {
    throw new Error(`Upstash returned HTTP ${response.status}`);
  }

  const results = await response.json();
  const currentCount = Number(results[0]?.result) || 1;

  if (currentCount > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetInSeconds: windowSeconds,
      isDistributed: true,
    };
  }

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - currentCount),
    resetInSeconds: windowSeconds,
    isDistributed: true,
  };
}

/**
 * Core rate limit evaluation function.
 * 
 * Strict Production Safety:
 * - When in production and accessing a sensitive endpoint (isWebhook === false):
 *   Requires distributed rate limiting. If Upstash is not configured or times out,
 *   it refuses to silently degrade to per-instance memory limits and fails closed safely.
 * - For webhooks (isWebhook === true):
 *   Never fails closed to avoid blocking legitimate payment deliveries; falls back to in-memory window.
 * - In development (NODE_ENV !== "production"):
 *   Smoothly falls back to in-memory sliding window for friction-free developer experience.
 *
 * @param {Object} options
 * @param {string} options.key - Unique rate-limiting key (e.g. `login:1.2.3.4`)
 * @param {number} options.limit - Maximum requests allowed within window
 * @param {number} options.windowSeconds - Window length in seconds
 * @param {boolean} [options.isWebhook=false] - Whether this check protects a provider webhook
 * @returns {Promise<{
 *   success: boolean,
 *   limit: number,
 *   remaining: number,
 *   resetInSeconds: number,
 *   isDistributed: boolean,
 *   failedClosed?: boolean
 * }>}
 */
export async function checkRateLimit({ key, limit, windowSeconds, isWebhook = false }) {
  const isProduction = process.env.NODE_ENV === "production";
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const hasUpstash = Boolean(upstashUrl && upstashToken);

  // Scenario A & C/D: Upstash is configured -> attempt distributed check
  if (hasUpstash) {
    try {
      return await checkUpstashRateLimit(key, limit, windowSeconds, upstashUrl, upstashToken);
    } catch (err) {
      console.warn(`[RateLimit Warning]: Upstash Redis check failed (${err.message}).`);

      // In production for sensitive endpoints, fail closed to prevent brute-force attacks during Redis outages
      if (isProduction && !isWebhook) {
        return {
          success: false,
          limit,
          remaining: 0,
          resetInSeconds: 60,
          isDistributed: true,
          failedClosed: true,
          error: "Security verification service temporarily unavailable. Please retry shortly.",
        };
      }

      // For webhooks or non-production, fall back to local window
      return checkLocalRateLimit(key, limit, windowSeconds);
    }
  }

  // Scenario B: Upstash is NOT configured
  if (isProduction && !isWebhook) {
    // In production, sensitive endpoints MUST NOT silently pretend distributed protection exists
    console.error("[RateLimit Critical]: UPSTASH_REDIS_REST_URL/TOKEN not configured in production. Failing closed on sensitive endpoint.");
    return {
      success: false,
      limit,
      remaining: 0,
      resetInSeconds: 60,
      isDistributed: false,
      failedClosed: true,
      error: "Distributed rate limiting is required in production but not configured.",
    };
  }

  // Local development / zero-config fallback (or PhonePe webhook fallback)
  return checkLocalRateLimit(key, limit, windowSeconds);
}

/**
 * Creates standardized HTTP 429 response with rate limit headers.
 */
export function rateLimitResponse(rateLimitResult, customMessage = null) {
  const resetSec = rateLimitResult.resetInSeconds || 60;
  return new Response(
    JSON.stringify({
      error: customMessage || rateLimitResult.error || "Too many requests. Please slow down and try again later.",
      retryAfter: resetSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resetSec),
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-RateLimit-Reset": String(resetSec),
      },
    }
  );
}

// ============================================================================
// TAILORED RATE LIMIT POLICIES
// ============================================================================

/**
 * Admin Login Rate Limiter:
 * Maximum 10 attempts per 15 minutes per IP or email.
 * Fails closed in production if distributed rate limiting is unavailable.
 */
export async function adminLoginRateLimit(request, email = "") {
  const ip = getClientIp(request);
  const cleanEmail = (email || "").trim().toLowerCase();
  const key = cleanEmail ? `admin_login:${ip}:${cleanEmail}` : `admin_login:${ip}`;
  return checkRateLimit({ key, limit: 10, windowSeconds: 900, isWebhook: false });
}

/**
 * Admin Session Refresh Rate Limiter:
 * Maximum 20 refresh exchanges per 15 minutes per IP.
 * Fails closed in production if distributed rate limiting is unavailable.
 */
export async function adminRefreshRateLimit(request) {
  const ip = getClientIp(request);
  return checkRateLimit({ key: `admin_refresh:${ip}`, limit: 20, windowSeconds: 900, isWebhook: false });
}

/**
 * Customer Order Tracking Lookup Rate Limiter:
 * Maximum 10 lookups per 5 minutes per IP (anti-enumeration & anti-bruteforce).
 * Fails closed in production if distributed rate limiting is unavailable.
 */
export async function orderTrackRateLimit(request) {
  const ip = getClientIp(request);
  return checkRateLimit({ key: `order_track:${ip}`, limit: 10, windowSeconds: 300, isWebhook: false });
}

/**
 * Customer Order Detail (vt) Verification Rate Limiter:
 * Maximum 30 detail requests per 5 minutes per IP.
 * Fails closed in production if distributed rate limiting is unavailable.
 */
export async function orderDetailRateLimit(request, orderId = "") {
  const ip = getClientIp(request);
  const cleanOrderId = (orderId || "").trim().toUpperCase();
  const key = cleanOrderId ? `order_detail:${ip}:${cleanOrderId}` : `order_detail:${ip}`;
  return checkRateLimit({ key, limit: 30, windowSeconds: 300, isWebhook: false });
}

/**
 * Public Order Creation Rate Limiter:
 * Maximum 15 order creation requests per 10 minutes per IP.
 * Fails closed in production if distributed rate limiting is unavailable.
 */
export async function orderCreateRateLimit(request) {
  const ip = getClientIp(request);
  return checkRateLimit({ key: `order_create:${ip}`, limit: 15, windowSeconds: 600, isWebhook: false });
}

/**
 * PhonePe Webhook Rate Limiter:
 * Generous threshold (60 requests / minute) to never drop legitimate gateway retries.
 * Never fails closed: falls back to local window so payments are never lost.
 * Webhook HMAC SHA-256 signature remains the authoritative security boundary.
 */
export async function phonePeWebhookRateLimit(request) {
  const ip = getClientIp(request);
  return checkRateLimit({ key: `phonepe_webhook:${ip}`, limit: 60, windowSeconds: 60, isWebhook: true });
}

/**
 * Customer Coupon Application Rate Limiter:
 * Maximum 10 coupon verification attempts per 5 minutes per IP.
 * Protects against coupon enumeration, dictionary attacks, and brute-forcing.
 * Fails closed in production if distributed rate limiting is unavailable.
 */
export async function couponApplyRateLimit(request) {
  const ip = getClientIp(request);
  return checkRateLimit({ key: `coupon_apply:${ip}`, limit: 10, windowSeconds: 300, isWebhook: false });
}
