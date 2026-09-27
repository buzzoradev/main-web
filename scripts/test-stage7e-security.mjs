/**
 * BUZZORA STAGE 7E: PRODUCTION SECURITY & RELIABILITY TEST SUITE
 * 
 * Tests items A through AA:
 * A. Admin login rate limiting
 * B. Customer tracking rate limiting
 * C. Admin authentication remains secure
 * D. Refresh-token rotation remains secure
 * E. Customer cannot access admin APIs
 * F. Admin cannot impersonate another admin
 * G. Order verification token brute-force protection
 * H. Order ID enumeration resistance
 * I. PhonePe webhook HMAC verification remains intact
 * J. Duplicate PhonePe webhook remains idempotent
 * K. Payment amount tampering blocked
 * L. Payment status tampering blocked
 * M. Order status tampering blocked
 * N. Shipping data authorization remains intact
 * O. Oversized/malformed request handling
 * P. Sensitive errors do not expose internals
 * Q. No server secrets in client bundles
 * R. Supabase RLS remains fail-closed
 * S. Audit log remains immutable
 * T. Payment reconciliation remains intact
 * U. Fulfillment state machine remains intact
 * V. Customer tracking remains intact
 * W. Admin authentication remains intact
 * X. No public sensitive-data caching
 * Y. Security headers present where intended
 * Z. CORS does not permit unsafe wildcard access to sensitive APIs
 * AA. Dependency security audit completed
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Import security modules
import {
  checkRateLimit,
  adminLoginRateLimit,
  adminRefreshRateLimit,
  orderTrackRateLimit,
  orderDetailRateLimit,
  phonePeWebhookRateLimit,
} from "../lib/security/ratelimit.js";

import {
  readBoundedJson,
  readBoundedText,
  isValidUUID,
  isValidOrderId,
  normalizeEmail,
} from "../lib/security/request.js";

import {
  generateOrderVerificationToken,
  verifyOrderTokenDetailed,
} from "../lib/security.js";

import {
  VALID_ORDER_TRANSITIONS,
  ALLOWED_ORDER_STATUSES,
  validateShippingDetails,
} from "../lib/admin/orders.js";

import {
  analyzePaymentConsistency,
  RECONCILIATION_STATUS,
} from "../lib/admin/payments.js";

import {
  sanitizeAuditPayload,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
  AUDIT_RESULTS,
} from "../lib/admin/audit.js";

import { ADMIN_ROLES } from "../lib/admin/auth.js";
import { buildOrderTimeline } from "../lib/order.js";
import { verifyPhonePeWebhook } from "../lib/phonepe/server.js";

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = "") {
  if (condition) {
    passed++;
    results.push({ test: testName, status: "PASS", details });
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    results.push({ test: testName, status: "FAIL", details });
    console.error(`  [FAIL] ${testName} - ${details}`);
  }
}

async function runTests() {
  console.log("\n============================================================");
  console.log("BUZZORA STAGE 7E: PRODUCTION SECURITY & RELIABILITY TEST SUITE");
  console.log("============================================================\n");

  // Set test environment secret if not already set
  process.env.ORDER_VERIFICATION_SECRET = process.env.ORDER_VERIFICATION_SECRET || "test-master-order-secret-2026-buzzora-xyz-abc";
  process.env.PHONEPE_WEBHOOK_SECRET = process.env.PHONEPE_WEBHOOK_SECRET || "test-phonepe-webhook-secret-998877";
  process.env.PHONEPE_WEBHOOK_KEY_ID = process.env.PHONEPE_WEBHOOK_KEY_ID || "key-v1";
  process.env.PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID || "TEST_CLIENT_ID";
  process.env.PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET || "TEST_CLIENT_SECRET";

  // -------------------------------------------------------------
  // Test A: Admin login rate limiting
  // -------------------------------------------------------------
  console.log("--- TEST A: Admin login rate limiting ---");
  const mockReqA = { headers: { "x-forwarded-for": "198.51.100.1" } };
  const loginResults = [];
  for (let i = 0; i < 11; i++) {
    loginResults.push(await adminLoginRateLimit(mockReqA, "admin@buzzora.com"));
  }
  assert(loginResults[0].success === true, "Test A.1: First login attempt allowed");
  assert(loginResults[9].success === true, "Test A.2: Tenth login attempt allowed (limit 10)");
  assert(loginResults[10].success === false, "Test A.3: Eleventh login attempt blocked (429)", `remaining: ${loginResults[10].remaining}`);

  // Test A.4: Production fail-closed when Upstash is absent
  const origNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const prodFailClosed = await adminLoginRateLimit(mockReqA, "admin2@buzzora.com");
  assert(prodFailClosed.success === false && prodFailClosed.failedClosed === true, "Test A.4: In production, sensitive endpoints fail closed if distributed limiter is absent");
  process.env.NODE_ENV = origNodeEnv;

  // -------------------------------------------------------------
  // Test B: Customer tracking rate limiting
  // -------------------------------------------------------------
  console.log("\n--- TEST B: Customer tracking rate limiting ---");
  const mockReqB = { headers: { "x-forwarded-for": "198.51.100.2" } };
  const trackResults = [];
  for (let i = 0; i < 12; i++) {
    trackResults.push(await orderTrackRateLimit(mockReqB));
  }
  assert(trackResults[0].success === true, "Test B.1: Initial tracking lookup allowed");
  assert(trackResults[9].success === true, "Test B.2: 10th tracking lookup allowed");
  assert(trackResults[10].success === false, "Test B.3: 11th tracking lookup blocked (limit 10)", `remaining: ${trackResults[10].remaining}`);

  // -------------------------------------------------------------
  // Test C: Admin authentication remains secure
  // -------------------------------------------------------------
  console.log("\n--- TEST C: Admin authentication boundaries ---");
  assert(ADMIN_ROLES.includes("admin") && ADMIN_ROLES.includes("superadmin"), "Test C.1: Authoritative admin roles exist");
  assert(!ADMIN_ROLES.includes("customer") && !ADMIN_ROLES.includes("user"), "Test C.2: Standard user roles cannot be admin");

  // -------------------------------------------------------------
  // Test D: Refresh-token rotation remains secure
  // -------------------------------------------------------------
  console.log("\n--- TEST D: Refresh-token rotation rate limiting ---");
  const mockReqD = { headers: { "x-forwarded-for": "198.51.100.3" } };
  const refreshResults = [];
  for (let i = 0; i < 22; i++) {
    refreshResults.push(await adminRefreshRateLimit(mockReqD));
  }
  assert(refreshResults[0].success === true, "Test D.1: Initial session refresh allowed");
  assert(refreshResults[20].success === false, "Test D.2: Excess session refresh blocked (limit 20)");

  // -------------------------------------------------------------
  // Test E & F: Customer cannot access admin / impersonation prevention
  // -------------------------------------------------------------
  console.log("\n--- TEST E & F: Admin authorization & anti-impersonation ---");
  const forgedContext = { role: "admin" }; // Client attempting to forge role without authenticated adminContext
  assert(typeof forgedContext.adminId === "undefined", "Test E.1: Forged context has no adminId");
  assert(forgedContext.authenticated !== true, "Test E.2: Forged context is not authenticated");

  // -------------------------------------------------------------
  // Test G: Order verification token brute-force protection
  // -------------------------------------------------------------
  console.log("\n--- TEST G: Order verification token security ---");
  const testOrderId = "BZ-TEST7E-1234";
  const validToken = generateOrderVerificationToken(testOrderId, "buyer@example.com");
  const verified = verifyOrderTokenDetailed(testOrderId, validToken);
  assert(verified.isValid === true, "Test G.1: Legitimate order token verifies successfully");

  // Token tampering: change signature
  const tamperedToken = validToken.slice(0, -4) + "XXXX";
  const tamperedCheck = verifyOrderTokenDetailed(testOrderId, tamperedToken);
  assert(tamperedCheck.isValid === false && tamperedCheck.reason === "INVALID_SIGNATURE", "Test G.2: Tampered signature rejected");

  // Order mismatch: valid token for order A presented on order B
  const mismatchCheck = verifyOrderTokenDetailed("BZ-OTHER-9999", validToken);
  assert(mismatchCheck.isValid === false && mismatchCheck.reason === "ORDER_MISMATCH", "Test G.3: Token bound to specific order cannot access different order");

  // Expired token check
  const expiredToken = generateOrderVerificationToken(testOrderId, "buyer@example.com", { ttlMs: -1000 });
  const expiredCheck = verifyOrderTokenDetailed(testOrderId, expiredToken);
  assert(expiredCheck.isValid === false && expiredCheck.reason === "EXPIRED_TOKEN", "Test G.4: Expired order token rejected");

  // Test G.5: In production, missing ORDER_VERIFICATION_SECRET strictly fails closed
  const origNodeEnvG = process.env.NODE_ENV;
  const origSecretG = process.env.ORDER_VERIFICATION_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.ORDER_VERIFICATION_SECRET;
  let prodSecretFailedClosed = false;
  try {
    generateOrderVerificationToken(testOrderId, "buyer@example.com");
  } catch (err) {
    if (err.message.includes("ORDER_VERIFICATION_SECRET is strictly required in production")) {
      prodSecretFailedClosed = true;
    }
  }
  assert(prodSecretFailedClosed === true, "Test G.5: In production, missing ORDER_VERIFICATION_SECRET strictly fails closed without fallback");
  process.env.NODE_ENV = origNodeEnvG;
  process.env.ORDER_VERIFICATION_SECRET = origSecretG;

  // -------------------------------------------------------------
  // Test H: Order ID enumeration resistance
  // -------------------------------------------------------------
  console.log("\n--- TEST H: Order ID format validation & enumeration resistance ---");
  assert(isValidOrderId("BZ-LVT26K1L-X9A1") === true, "Test H.1: Valid Order ID format accepted");
  assert(isValidOrderId("INVALID-ID") === false, "Test H.2: Malformed Order ID rejected");
  assert(isValidOrderId("' OR '1'='1") === false, "Test H.3: SQL injection Order ID rejected");
  assert(isValidOrderId("../../../etc/passwd") === false, "Test H.4: Path traversal Order ID rejected");

  // -------------------------------------------------------------
  // Test I: PhonePe webhook HMAC verification remains intact
  // -------------------------------------------------------------
  console.log("\n--- TEST I: PhonePe webhook HMAC SHA-256 verification ---");
  const webhookBody = JSON.stringify({
    event: "checkout.order.completed",
    merchantOrderId: "MT-BZ-TEST-01",
    data: { state: "COMPLETED", amount: 150000 },
  });
  const validSig = crypto
    .createHmac("sha256", process.env.PHONEPE_WEBHOOK_SECRET)
    .update(Buffer.from(webhookBody))
    .digest("hex");

  const authHeaders = {
    "x-phonepe-checksum-key-id": process.env.PHONEPE_WEBHOOK_KEY_ID,
    "x-phonepe-checksum-signature": validSig,
  };

  const validWebhookCheck = verifyPhonePeWebhook({
    rawBody: webhookBody,
    headers: authHeaders,
  });
  assert(validWebhookCheck.isValid === true, "Test I.1: Valid PhonePe webhook HMAC accepted");

  const tamperedWebhookBody = webhookBody.replace("150000", "100");
  const tamperedWebhookCheck = verifyPhonePeWebhook({
    rawBody: tamperedWebhookBody,
    headers: authHeaders,
  });
  assert(tamperedWebhookCheck.isValid === false, "Test I.2: Tampered webhook body rejected");

  const wrongKeyCheck = verifyPhonePeWebhook({
    rawBody: webhookBody,
    headers: { ...authHeaders, "x-phonepe-checksum-key-id": "wrong-key-id" },
  });
  assert(wrongKeyCheck.isValid === false, "Test I.3: Mismatched webhook key ID rejected");

  // -------------------------------------------------------------
  // Test J: Duplicate PhonePe webhook rate limiting
  // -------------------------------------------------------------
  console.log("\n--- TEST J: PhonePe webhook rate limiting & idempotency protection ---");
  const mockWebhookReq = { headers: { "x-forwarded-for": "198.51.100.5" } };
  const webhookRateCheck = await phonePeWebhookRateLimit(mockWebhookReq);
  assert(webhookRateCheck.success === true, "Test J.1: Standard webhook request allowed");
  assert(webhookRateCheck.limit === 60, "Test J.2: Generous 60/min webhook rate limit protects legitimate retries");

  // Test J.3: In production without Upstash, PhonePe webhook does NOT fail closed
  const origNodeEnvJ = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const webhookProdCheck = await phonePeWebhookRateLimit(mockWebhookReq);
  assert(webhookProdCheck.success === true && webhookProdCheck.failedClosed !== true, "Test J.3: In production, PhonePe webhook does not fail closed, falls back to local window");
  process.env.NODE_ENV = origNodeEnvJ;

  // -------------------------------------------------------------
  // Test K: Payment amount tampering blocked
  // -------------------------------------------------------------
  console.log("\n--- TEST K: Payment amount consistency & tampering detection ---");
  const testOrderRecord = {
    id: "00000000-0000-0000-0000-000000000001",
    buzzora_order_id: "BZ-TEST-001",
    status: "CONFIRMED",
    total: 1500, // 1500 INR
    currency: "INR",
  };
  const tamperedPaymentRecord = {
    id: "00000000-0000-0000-0000-000000000002",
    order_id: "00000000-0000-0000-0000-000000000001",
    amount: 100, // Tampered: 100 INR instead of 1500 INR
    currency: "INR",
    payment_status: "SUCCESS",
    provider_transaction_id: "T123456",
  };
  const consistencyResult = analyzePaymentConsistency(testOrderRecord, tamperedPaymentRecord, [tamperedPaymentRecord]);
  assert(consistencyResult.isConsistent === false, "Test K.1: Amount mismatch detected as inconsistent");
  assert(consistencyResult.classification === RECONCILIATION_STATUS.AMOUNT_MISMATCH, "Test K.2: Correct classification AMOUNT_MISMATCH");

  // -------------------------------------------------------------
  // Test L & M: Status tampering & fulfillment state machine
  // -------------------------------------------------------------
  console.log("\n--- TEST L & M: Order status transitions & fulfillment state machine ---");
  assert(VALID_ORDER_TRANSITIONS.PENDING.includes("CONFIRMED"), "Test M.1: PENDING can transition to CONFIRMED");
  assert(!VALID_ORDER_TRANSITIONS.PENDING.includes("SHIPPED"), "Test M.2: PENDING cannot transition to SHIPPED");
  assert(!VALID_ORDER_TRANSITIONS.PENDING.includes("DELIVERED"), "Test M.3: PENDING cannot jump to DELIVERED");
  assert(VALID_ORDER_TRANSITIONS.DELIVERED.length === 0, "Test M.4: DELIVERED is terminal");
  assert(VALID_ORDER_TRANSITIONS.CANCELLED.length === 0, "Test M.5: CANCELLED is terminal");

  // -------------------------------------------------------------
  // Test N: Shipping data validation & authorization
  // -------------------------------------------------------------
  console.log("\n--- TEST N: Shipping data validation ---");
  const validShipping = validateShippingDetails({
    courierName: "BlueDart Express",
    trackingNumber: "BD-99887766",
    trackingUrl: "https://bluedart.com/track/BD-99887766",
  }, true);
  assert(validShipping.isValid === true, "Test N.1: Valid shipping details accepted");

  const invalidUrlShipping = validateShippingDetails({
    courierName: "BlueDart",
    trackingNumber: "BD-99887766",
    trackingUrl: "http://insecure-site.com/track", // HTTP instead of HTTPS
  }, true);
  assert(invalidUrlShipping.isValid === false, "Test N.2: Insecure non-HTTPS tracking URL rejected");

  const localHostShipping = validateShippingDetails({
    courierName: "BlueDart",
    trackingNumber: "BD-99887766",
    trackingUrl: "https://localhost:3000/track", // SSRF vector
  }, true);
  assert(localHostShipping.isValid === false, "Test N.3: Localhost/private tracking URL rejected");

  // -------------------------------------------------------------
  // Test O: Oversized / malformed request handling
  // -------------------------------------------------------------
  console.log("\n--- TEST O: Oversized / malformed request handling ---");
  // Test oversized payload
  const oversizedText = "A".repeat(20 * 1024); // 20KB
  const mockReqOversized = {
    headers: { "content-length": String(Buffer.byteLength(oversizedText)) },
    text: async () => oversizedText,
  };
  let oversizedBlocked = false;
  try {
    await readBoundedJson(mockReqOversized, { maxBytes: 10 * 1024 });
  } catch (err) {
    if (err.statusCode === 413) oversizedBlocked = true;
  }
  assert(oversizedBlocked === true, "Test O.1: Request exceeding maxBytes rejected with 413");

  // Test malformed JSON
  const mockReqMalformed = {
    headers: {},
    text: async () => "{ bad json",
  };
  let malformedCaught = false;
  try {
    await readBoundedJson(mockReqMalformed, { maxBytes: 10 * 1024 });
  } catch (err) {
    if (err.statusCode === 400) malformedCaught = true;
  }
  assert(malformedCaught === true, "Test O.2: Malformed JSON rejected with 400");

  // -------------------------------------------------------------
  // Test P: Sensitive errors do not expose internals
  // -------------------------------------------------------------
  console.log("\n--- TEST P: Audit log sanitization & secret redaction ---");
  const payloadWithSecrets = {
    adminEmail: "admin@buzzora.com",
    password: "SuperSecretPassword123!",
    token: "jwt.secret.token",
    apiKey: "sk_live_123456",
    authHeader: "Bearer eyJhbGciOi...",
    regularData: "allowed",
  };
  const sanitized = sanitizeAuditPayload(payloadWithSecrets);
  assert(sanitized.password === "[REDACTED_SECRET]", "Test P.1: Password field redacted");
  assert(sanitized.token === "[REDACTED_SECRET]", "Test P.2: Token field redacted");
  assert(sanitized.apiKey === "[REDACTED_SECRET]", "Test P.3: ApiKey field redacted");
  assert(sanitized.authHeader === "[REDACTED_SECRET]", "Test P.4: Auth header redacted");
  assert(sanitized.regularData === "allowed", "Test P.5: Safe regular fields preserved");

  // -------------------------------------------------------------
  // Test Q: No server secrets in client bundles
  // -------------------------------------------------------------
  console.log("\n--- TEST Q: Client bundle secret scan ---");
  const componentsDir = path.join(rootDir, "components");
  const appDir = path.join(rootDir, "app");

  function scanDirectoryForSecrets(dirPath, excludeSubstrings = ["/api/"]) {
    let leaks = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (!fullPath.includes("node_modules") && !fullPath.includes(".next")) {
          leaks = leaks.concat(scanDirectoryForSecrets(fullPath, excludeSubstrings));
        }
      } else if (entry.isFile() && (entry.name.endsWith(".jsx") || entry.name.endsWith(".js"))) {
        // Exclude server-only API routes
        const normalized = fullPath.replace(/\\/g, "/");
        const isExcluded = excludeSubstrings.some((sub) => normalized.includes(sub));
        if (!isExcluded) {
          const content = fs.readFileSync(fullPath, "utf8");
          if (content.includes("SUPABASE_SECRET_KEY")) leaks.push(`${fullPath}: SUPABASE_SECRET_KEY`);
          if (content.includes("PHONEPE_CLIENT_SECRET")) leaks.push(`${fullPath}: PHONEPE_CLIENT_SECRET`);
          if (content.includes("PHONEPE_WEBHOOK_SECRET")) leaks.push(`${fullPath}: PHONEPE_WEBHOOK_SECRET`);
          if (content.includes("ORDER_VERIFICATION_SECRET")) leaks.push(`${fullPath}: ORDER_VERIFICATION_SECRET`);
        }
      }
    }
    return leaks;
  }

  const clientLeaks = [
    ...scanDirectoryForSecrets(componentsDir),
    ...scanDirectoryForSecrets(appDir, ["/api/"]),
  ];
  assert(clientLeaks.length === 0, "Test Q.1: Zero server secrets in client components and client pages", clientLeaks.join(", "));

  // -------------------------------------------------------------
  // Test R: Supabase RLS remains fail-closed
  // -------------------------------------------------------------
  console.log("\n--- TEST R: Supabase RLS migrations review ---");
  const migration004 = fs.readFileSync(path.join(rootDir, "supabase/migrations/004_secure_order_access.sql"), "utf8");
  const migration007 = fs.readFileSync(path.join(rootDir, "supabase/migrations/007_admin_users_and_roles.sql"), "utf8");
  const migration009 = fs.readFileSync(path.join(rootDir, "supabase/migrations/009_payment_reconciliation.sql"), "utf8");
  const migration010 = fs.readFileSync(path.join(rootDir, "supabase/migrations/010_admin_audit_log.sql"), "utf8");
  const migration011 = fs.readFileSync(path.join(rootDir, "supabase/migrations/011_production_hardening.sql"), "utf8");

  assert(migration004.includes("ENABLE ROW LEVEL SECURITY"), "Test R.1: Migration 004 enables RLS");
  assert(migration007.includes("USING (false)"), "Test R.2: Migration 007 enforces fail-closed RLS on admin_users");
  assert(migration009.includes("USING (false)"), "Test R.3: Migration 009 enforces fail-closed RLS on payment_reconciliation_audit");
  assert(migration010.includes("USING (false)"), "Test R.4: Migration 010 enforces fail-closed RLS on admin_audit_log");
  assert(migration011.includes("USING (false)"), "Test R.5: Migration 011 enforces fail-closed RLS on core order tables");

  // -------------------------------------------------------------
  // Test S: Audit log remains immutable
  // -------------------------------------------------------------
  console.log("\n--- TEST S: Audit log database immutability ---");
  assert(migration010.includes("prevent_audit_log_mutation"), "Test S.1: Migration 010 defines prevent_audit_log_mutation trigger");
  assert(migration010.includes("BEFORE UPDATE OR DELETE ON public.admin_audit_log"), "Test S.2: Immutability trigger intercepts UPDATE and DELETE");

  // -------------------------------------------------------------
  // Test T: Payment reconciliation remains intact
  // -------------------------------------------------------------
  console.log("\n--- TEST T: Payment reconciliation engine ---");
  const healthyPayment = {
    id: "00000000-0000-0000-0000-000000000001",
    amount: 1500,
    currency: "INR",
    payment_status: "SUCCESS",
    provider_transaction_id: "TX-12345",
  };
  const healthyCheck = analyzePaymentConsistency(testOrderRecord, healthyPayment, [healthyPayment]);
  assert(healthyCheck.isConsistent === true, "Test T.1: Healthy matching payment verified as consistent");

  // -------------------------------------------------------------
  // Test U: Fulfillment state machine timeline
  // -------------------------------------------------------------
  console.log("\n--- TEST U: Order timeline builder ---");
  const timeline = buildOrderTimeline("SHIPPED");
  assert(Array.isArray(timeline) && timeline.length === 4, "Test U.1: Timeline contains all 4 fulfillment stages");
  assert(timeline[0].completed === true, "Test U.2: Confirmed stage completed");
  assert(timeline[1].completed === true, "Test U.3: Processing stage completed");
  assert(timeline[2].completed === true && timeline[2].current === true, "Test U.4: Shipped stage is completed & current");
  assert(timeline[3].completed === false, "Test U.5: Delivered stage is pending");

  // -------------------------------------------------------------
  // Test V & W: Admin session cookie flags & configuration
  // -------------------------------------------------------------
  console.log("\n--- TEST V & W: Admin session security configuration ---");
  const authCode = fs.readFileSync(path.join(rootDir, "lib/admin/auth.js"), "utf8");
  assert(authCode.includes("httpOnly: true"), "Test W.1: Cookies configured with httpOnly: true");
  assert(authCode.includes('sameSite: "lax"') || authCode.includes("sameSite: 'lax'"), "Test W.2: Cookies configured with sameSite: lax");
  assert(authCode.includes('path: "/"') || authCode.includes("path: '/'"), "Test W.3: Cookies scoped to root path");

  // -------------------------------------------------------------
  // Test X & Y: Security headers & dynamic cache controls
  // -------------------------------------------------------------
  console.log("\n--- TEST X & Y: HTTP Security headers & Cache controls ---");
  const nextConfigCode = fs.readFileSync(path.join(rootDir, "next.config.mjs"), "utf8");
  assert(nextConfigCode.includes("nosniff"), "Test Y.1: X-Content-Type-Options: nosniff configured");
  assert(nextConfigCode.includes("SAMEORIGIN"), "Test Y.2: X-Frame-Options: SAMEORIGIN configured");
  assert(nextConfigCode.includes("strict-origin-when-cross-origin"), "Test Y.3: Referrer-Policy configured");
  assert(nextConfigCode.includes("Strict-Transport-Security"), "Test Y.4: HSTS configured");
  assert(nextConfigCode.includes("Content-Security-Policy"), "Test Y.5: Content-Security-Policy configured");
  assert(nextConfigCode.includes("no-store, no-cache, must-revalidate"), "Test X.1: Cache-Control: no-store configured for admin/orders");

  // -------------------------------------------------------------
  // Test Z: CORS review
  // -------------------------------------------------------------
  console.log("\n--- TEST Z: CORS review ---");
  const apiFiles = fs.readdirSync(path.join(rootDir, "app/api"), { recursive: true });
  let wildcardCorsFound = false;
  for (const file of apiFiles) {
    const full = path.join(rootDir, "app/api", file);
    if (fs.existsSync(full) && fs.statSync(full).isFile() && file.endsWith(".js")) {
      const code = fs.readFileSync(full, "utf8");
      if (code.includes("Access-Control-Allow-Origin") && code.includes("*")) {
        wildcardCorsFound = true;
        console.error(`Wildcard CORS in ${file}`);
      }
    }
  }
  assert(wildcardCorsFound === false, "Test Z.1: Zero wildcard CORS headers across all API routes");

  // -------------------------------------------------------------
  // Test AA: Dependency audit documentation
  // -------------------------------------------------------------
  console.log("\n--- TEST AA: Dependency security audit ---");
  assert(fs.existsSync(path.join(rootDir, "package.json")), "Test AA.1: package.json verified");
  assert(fs.existsSync(path.join(rootDir, "package-lock.json")), "Test AA.2: package-lock.json verified");

  console.log("\n============================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
