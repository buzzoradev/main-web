import crypto from "crypto";

// ============================================================================
// PhonePe Standard Checkout (v2 API / OAuth 2.0) Server Utility Layer
// Strictly server-only. Never expose PhonePe credentials or tokens to the client.
// ============================================================================

// In-memory token cache for server instance
let cachedToken = null;
let tokenExpiresAt = 0; // Epoch milliseconds

/**
 * Validates and returns the server-side PhonePe environment configuration.
 * Throws a descriptive error if required environment variables are missing.
 */
export function getPhonePeConfig() {
  const env = (process.env.PHONEPE_ENV || "sandbox").toLowerCase();
  const isProduction = env === "production";

  const clientId = process.env.PHONEPE_CLIENT_ID?.trim();
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET?.trim();
  const clientVersion = process.env.PHONEPE_CLIENT_VERSION?.trim() || "1";

  if (!clientId || !clientSecret) {
    throw new Error(
      "PhonePe server configuration error: PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET must be set on the server."
    );
  }

  const defaultAuthUrl = isProduction
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

  const defaultApiBaseUrl = isProduction
    ? "https://api.phonepe.com/apis/pg"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

  const authUrl = process.env.PHONEPE_AUTH_URL?.trim() || defaultAuthUrl;
  const apiBaseUrl = process.env.PHONEPE_API_BASE_URL?.trim() || defaultApiBaseUrl;

  return {
    env,
    isProduction,
    clientId,
    clientSecret,
    clientVersion,
    authUrl,
    apiBaseUrl,
    webhookSecret: process.env.PHONEPE_WEBHOOK_SECRET?.trim(),
    webhookKeyId: process.env.PHONEPE_WEBHOOK_KEY_ID?.trim(),
  };
}

/**
 * Retrieves a valid OAuth 2.0 access token from PhonePe identity manager.
 * Uses client_credentials grant type and caches the token in server memory until expiry.
 */
export async function getPhonePeAccessToken() {
  const config = getPhonePeConfig();

  // Return cached token if valid (with 60-second safety buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const bodyParams = new URLSearchParams({
    client_id: config.clientId,
    client_version: config.clientVersion,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
  });

  let response;
  try {
    response = await fetch(config.authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams,
      cache: "no-store",
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
  } catch (err) {
    throw new Error(`PhonePe OAuth network request failed: ${err.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`PhonePe OAuth server returned non-JSON response (HTTP ${response.status}).`);
  }

  const token = data.access_token || data.accessToken;
  if (!response.ok || !token) {
    const errorMsg = data.error_description || data.message || data.code || `HTTP ${response.status}`;
    // Security: Do NOT log clientSecret or token
    console.error(`[PhonePe OAuth Error]: ${errorMsg}`);
    throw new Error(`PhonePe OAuth authentication failed: ${errorMsg}`);
  }

  const expiresInSec = Number(data.expires_in || data.expiresIn) || 3600;
  cachedToken = token;
  tokenExpiresAt = Date.now() + expiresInSec * 1000;

  return token;
}

/**
 * Initiates a Standard Checkout payment request with PhonePe (/checkout/v2/pay).
 *
 * @param {Object} params
 * @param {string} params.merchantOrderId - Unique payment attempt identifier (e.g. MT-BZ-XXXX-1)
 * @param {number} params.amountInPaisa - Integer amount in paise (> 0)
 * @param {string} params.redirectUrl - Server callback / return URL after payment
 * @param {string} [params.customerPhone] - Optional customer mobile number
 * @param {Object} [params.metaInfo] - Optional metadata object
 */
export async function initiatePhonePePayment({
  merchantOrderId,
  amountInPaisa,
  redirectUrl,
  customerPhone,
  metaInfo,
}) {
  if (!merchantOrderId || typeof merchantOrderId !== "string") {
    throw new Error("merchantOrderId is required and must be a string.");
  }

  if (!Number.isInteger(amountInPaisa) || amountInPaisa <= 0) {
    throw new Error("amountInPaisa must be a positive integer in paise.");
  }

  if (!redirectUrl || typeof redirectUrl !== "string") {
    throw new Error("redirectUrl is required for PhonePe checkout.");
  }

  const config = getPhonePeConfig();
  const token = await getPhonePeAccessToken();

  const payload = {
    merchantOrderId,
    amount: amountInPaisa,
    expireAfter: 1200,
    metaInfo: {
      udf1: "buzzora-web",
      ...(customerPhone ? { customerPhone: String(customerPhone).trim() } : {}),
      ...(metaInfo || {}),
    },
    paymentFlow: {
      type: "PG_CHECKOUT",
      message: "Buzzora order payment",
      merchantUrls: {
        redirectUrl,
      },
    },
  };

  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}/checkout/v2/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000), // 15s timeout
    });
  } catch (err) {
    throw new Error(`PhonePe initiate payment network request failed: ${err.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`PhonePe initiate payment returned non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const errorMsg = data.message || data.code || `HTTP ${response.status}`;
    console.error(`[PhonePe Initiate Payment Error]: ${errorMsg}`);
    throw new Error(`PhonePe payment initiation failed: ${errorMsg}`);
  }

  const tokenUrl = data.redirectUrl || data.data?.redirectUrl || data.tokenUrl || data.data?.tokenUrl;
  if (!tokenUrl) {
    throw new Error("PhonePe payment response missing checkout redirectUrl.");
  }

  return {
    success: true,
    merchantOrderId,
    redirectUrl: tokenUrl,
    tokenUrl,
    rawResponse: data,
  };
}

/**
 * Queries PhonePe for the status of a payment attempt (/checkout/v2/order/{merchantOrderId}/status).
 *
 * @param {string} merchantOrderId - Unique payment attempt identifier
 */
export async function getPhonePeOrderStatus(merchantOrderId) {
  if (!merchantOrderId || typeof merchantOrderId !== "string") {
    throw new Error("merchantOrderId is required for status check.");
  }

  const config = getPhonePeConfig();
  const token = await getPhonePeAccessToken();

  let response;
  try {
    response = await fetch(
      `${config.apiBaseUrl}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000), // 15s timeout
      }
    );
  } catch (err) {
    throw new Error(`PhonePe status check network request failed: ${err.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`PhonePe status check returned non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const errorMsg = data.message || data.code || `HTTP ${response.status}`;
    console.error(`[PhonePe Status API Error]: ${errorMsg}`);
    throw new Error(`PhonePe status check failed: ${errorMsg}`);
  }

  const state = data.state || data.data?.state || "UNKNOWN";
  const code = data.code || data.data?.code || "UNKNOWN";
  const amount = Number(data.amount ?? data.data?.amount);

  const isSuccess = state === "COMPLETED" || code === "PAYMENT_SUCCESS";
  const isFailed =
    state === "FAILED" ||
    code === "PAYMENT_ERROR" ||
    code === "PAYMENT_DECLINED" ||
    code === "TIMED_OUT";

  const providerTransactionId =
    data.transactionId ||
    data.data?.transactionId ||
    data.providerReferenceId ||
    data.data?.providerReferenceId ||
    null;

  return {
    success: true,
    merchantOrderId,
    state,
    code,
    isSuccess,
    isFailed,
    amount: Number.isFinite(amount) ? amount : null,
    providerTransactionId,
    rawResponse: data,
  };
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies PhonePe S2S Webhook authenticity using HMAC SHA-256 signature verification.
 * Operates strictly on the exact raw request body (string or Buffer) to prevent canonicalization issues.
 * Uses timingSafeEqual for constant-time comparisons.
 *
 * PhonePe HMAC Headers:
 * - x-phonepe-checksum-key-id
 * - x-phonepe-checksum-signature
 *
 * @param {Object} params
 * @param {string|Buffer} params.rawBody - Exact unparsed request body
 * @param {Object|Headers} params.headers - HTTP request headers
 * @param {string} [params.webhookSecret] - Optional override for PHONEPE_WEBHOOK_SECRET
 * @param {string} [params.webhookKeyId] - Optional override for PHONEPE_WEBHOOK_KEY_ID
 */
export function verifyPhonePeWebhook({ rawBody, headers, webhookSecret, webhookKeyId }) {
  const config = getPhonePeConfig();
  const secret = webhookSecret || config.webhookSecret;
  const expectedKeyId = webhookKeyId || config.webhookKeyId;

  if (!secret) {
    return {
      isValid: false,
      error: "PhonePe webhook secret (PHONEPE_WEBHOOK_SECRET) is not configured on the server.",
    };
  }

  // Normalize header keys
  const normalizedHeaders = {};
  if (headers && typeof headers === "object") {
    if (typeof headers.get === "function") {
      normalizedHeaders["x-phonepe-checksum-key-id"] =
        headers.get("x-phonepe-checksum-key-id") || headers.get("X-PHONEPE-CHECKSUM-KEY-ID");
      normalizedHeaders["x-phonepe-checksum-signature"] =
        headers.get("x-phonepe-checksum-signature") || headers.get("X-PHONEPE-CHECKSUM-SIGNATURE");
    } else {
      for (const [key, value] of Object.entries(headers)) {
        normalizedHeaders[key.toLowerCase()] = value;
      }
    }
  }

  const keyIdHeader = normalizedHeaders["x-phonepe-checksum-key-id"];
  const signatureHeader = normalizedHeaders["x-phonepe-checksum-signature"];

  if (!signatureHeader) {
    return { isValid: false, error: "Missing x-phonepe-checksum-signature header." };
  }

  if (expectedKeyId && keyIdHeader && expectedKeyId !== keyIdHeader) {
    return {
      isValid: false,
      error: `Webhook key ID mismatch. Expected '${expectedKeyId}', received '${keyIdHeader}'.`,
    };
  }

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || ""));

  // Calculate HMAC-SHA256 in hex and base64 formats
  const computedHex = crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");
  const computedBase64 = crypto.createHmac("sha256", secret).update(bodyBuffer).digest("base64");

  const isHexMatch = safeCompare(computedHex.toLowerCase(), signatureHeader.toLowerCase());
  const isBase64Match = safeCompare(computedBase64, signatureHeader);

  if (isHexMatch || isBase64Match) {
    return { isValid: true, keyId: keyIdHeader };
  }

  return { isValid: false, error: "Webhook signature verification failed." };
}
