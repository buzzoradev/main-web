/**
 * BUZZORA VERIFICATION: GOOGLE SIGN-IN REMOVAL & PRODUCTION ERROR HANDLING
 *
 * Tests the 10 targeted assertions:
 * 1. Google sign-in code removed.
 * 2. Google sign-in UI removed.
 * 3. Checkout structure valid & manual customer fields intact.
 * 4. Checkout manual customer flow & order placement logic intact.
 * 5. API routes return safe JSON error contracts (no HTML/redirects).
 * 6. Next.js route error boundary (app/error.js) exists and safe.
 * 7. Next.js global error boundary (app/global-error.js) exists, safe, and has html/body.
 * 8. Next.js not-found page (app/not-found.js) exists and branded.
 * 9. Production error components do NOT expose stack traces or internal secrets.
 * 10. Zero error paths redirect to Google; zero client secret leakage.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log("\n============================================================");
console.log("BUZZORA: GOOGLE SIGN-IN REMOVAL & ERROR HANDLING AUDIT");
console.log("============================================================\n");

// --- TEST 1: Google Sign-In Component & Code Removal ---
console.log("--- 1. Google Sign-In Code Removal ---");

test("1.1: components/GoogleSignIn.jsx is completely removed", () => {
  const fileExists = fs.existsSync(path.join(ROOT, "components", "GoogleSignIn.jsx"));
  assert.strictEqual(fileExists, false, "components/GoogleSignIn.jsx should no longer exist");
});

test("1.2: No Google Identity Services / GSI references in client components", () => {
  const componentsDir = path.join(ROOT, "components");
  const compFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith(".js") || f.endsWith(".jsx"));
  for (const f of compFiles) {
    const content = fs.readFileSync(path.join(componentsDir, f), "utf8");
    assert.strictEqual(content.includes("accounts.google.com/gsi"), false, `Found GSI script in ${f}`);
    assert.strictEqual(content.includes("google.accounts"), false, `Found google.accounts in ${f}`);
    assert.strictEqual(content.includes("NEXT_PUBLIC_GOOGLE_CLIENT_ID"), false, `Found NEXT_PUBLIC_GOOGLE_CLIENT_ID in ${f}`);
  }
});

test("1.3: Content-Security-Policy does not whitelist accounts.google.com in script-src or frame-src", () => {
  const nextConfig = fs.readFileSync(path.join(ROOT, "next.config.mjs"), "utf8");
  assert.strictEqual(nextConfig.includes("https://accounts.google.com"), false, "accounts.google.com must not be in CSP");
  // Ensure Google Fonts remains intact
  assert.strictEqual(nextConfig.includes("https://fonts.googleapis.com"), true, "Google Fonts style-src must be preserved");
});

// --- TEST 2 & 3: Checkout UI & Manual Fields ---
console.log("\n--- 2 & 3. Checkout Form UI & Manual Input Validation ---");

test("2.1: CheckoutForm does not import or render GoogleSignIn", () => {
  const checkoutCode = fs.readFileSync(path.join(ROOT, "components", "CheckoutForm.jsx"), "utf8");
  assert.strictEqual(checkoutCode.includes("GoogleSignIn"), false, "CheckoutForm must not contain GoogleSignIn");
  assert.strictEqual(checkoutCode.includes("googleUser"), false, "CheckoutForm must not contain googleUser state");
  assert.strictEqual(checkoutCode.includes("handleGoogleSignIn"), false, "CheckoutForm must not contain handleGoogleSignIn");
});

test("3.1: CheckoutForm contains all required manual customer fields", () => {
  const checkoutCode = fs.readFileSync(path.join(ROOT, "components", "CheckoutForm.jsx"), "utf8");
  const requiredFields = ["name", "email", "phone", "address", "city", "state", "postcode", "country"];
  for (const f of requiredFields) {
    assert.strictEqual(
      checkoutCode.includes(`name: "${f}"`),
      true,
      `CheckoutForm fields must include field '${f}'`
    );
  }
});

test("3.2: CheckoutForm preserves payment provider branching (PhonePe, Razorpay, WhatsApp)", () => {
  const checkoutCode = fs.readFileSync(path.join(ROOT, "components", "CheckoutForm.jsx"), "utf8");
  assert.strictEqual(checkoutCode.includes("payWithPhonePe"), true, "payWithPhonePe must be preserved");
  assert.strictEqual(checkoutCode.includes("ONLINE_PAYMENT"), true, "ONLINE_PAYMENT must be preserved");
  assert.strictEqual(checkoutCode.includes("idempotencyKey"), true, "idempotencyKey must be preserved");
});

// --- TEST 4 & 5: API Error Safety & Contracts ---
console.log("\n--- 4 & 5. API Error Handling & JSON Contracts ---");

test("4.1: /api/orders error handler returns JSON (not HTML or redirects)", () => {
  const ordersRoute = fs.readFileSync(path.join(ROOT, "app", "api", "orders", "route.js"), "utf8");
  assert.strictEqual(ordersRoute.includes("NextResponse.json("), true, "/api/orders must return NextResponse.json");
  assert.strictEqual(ordersRoute.includes("NextResponse.redirect("), false, "/api/orders must never redirect");
});

test("4.2: /api/phonepe/order error handler returns JSON with safe status codes", () => {
  const phonePeOrderRoute = fs.readFileSync(path.join(ROOT, "app", "api", "phonepe", "order", "route.js"), "utf8");
  assert.strictEqual(phonePeOrderRoute.includes("NextResponse.json("), true, "/api/phonepe/order must return NextResponse.json");
  assert.strictEqual(phonePeOrderRoute.includes("NextResponse.redirect("), false, "/api/phonepe/order must never redirect");
});

test("4.3: /api/orders/track returns JSON responses with rate limiting and validation", () => {
  const trackRoute = fs.readFileSync(path.join(ROOT, "app", "api", "orders", "track", "route.js"), "utf8");
  assert.strictEqual(trackRoute.includes("NextResponse.json("), true, "/api/orders/track must return NextResponse.json");
  assert.strictEqual(trackRoute.includes("NextResponse.redirect("), false, "/api/orders/track must never redirect");
});

// --- TEST 6 & 7 & 8: App Router Error Boundaries ---
console.log("\n--- 6, 7 & 8. Next.js App Router Error Boundaries ---");

test("6.1: app/error.js exists as a client component with reset capability", () => {
  const errorFile = path.join(ROOT, "app", "error.js");
  assert.strictEqual(fs.existsSync(errorFile), true, "app/error.js must exist");
  const content = fs.readFileSync(errorFile, "utf8");
  assert.strictEqual(content.includes('"use client"'), true, "app/error.js must have 'use client'");
  assert.strictEqual(content.includes("reset"), true, "app/error.js must accept reset prop");
  assert.strictEqual(content.includes("Something went wrong"), true, "Must have friendly heading");
  assert.strictEqual(content.includes("Reference ID:"), true, "Must display reference ID badge");
});

test("6.2: app/error.js does NOT expose raw error message or stack trace", () => {
  const content = fs.readFileSync(path.join(ROOT, "app", "error.js"), "utf8");
  assert.strictEqual(content.includes("{error.message}"), false, "Must not render raw error.message in UI");
  assert.strictEqual(content.includes("{error.stack}"), false, "Must not render raw error.stack in UI");
  assert.strictEqual(content.includes("error?.message"), false, "Must not render raw error?.message in UI");
});

test("7.1: app/global-error.js exists, includes <html> and <body>, and provides reset", () => {
  const globalErrorFile = path.join(ROOT, "app", "global-error.js");
  assert.strictEqual(fs.existsSync(globalErrorFile), true, "app/global-error.js must exist");
  const content = fs.readFileSync(globalErrorFile, "utf8");
  assert.strictEqual(content.includes('"use client"'), true, "app/global-error.js must have 'use client'");
  assert.strictEqual(content.includes("<html"), true, "global-error.js must include <html>");
  assert.strictEqual(content.includes("<body"), true, "global-error.js must include <body>");
  assert.strictEqual(content.includes("reset"), true, "global-error.js must accept reset prop");
  assert.strictEqual(content.includes("{error.stack}"), false, "Must not render error.stack in UI");
});

test("8.1: app/not-found.js exists and renders branded Buzzora 404", () => {
  const notFoundFile = path.join(ROOT, "app", "not-found.js");
  assert.strictEqual(fs.existsSync(notFoundFile), true, "app/not-found.js must exist");
  const content = fs.readFileSync(notFoundFile, "utf8");
  assert.strictEqual(content.includes("Page not found"), true, "Must include 'Page not found' heading");
  assert.strictEqual(content.includes("/shop"), true, "Must link to /shop");
  assert.strictEqual(content.includes("BeeCharacter"), true, "Must include BeeCharacter visual");
});

// --- TEST 9: Error Reference ID Utility ---
console.log("\n--- 9. Error Reference ID Format & Safety ---");

test("9.1: lib/error-id.js produces unique IDs in BZ-ERR-XXXXXX format", async () => {
  const { generateErrorReferenceId } = await import("../lib/error-id.js");
  const id1 = generateErrorReferenceId();
  const id2 = generateErrorReferenceId();
  assert.match(id1, /^BZ-ERR-[2-9A-Z]{6}$/, `Invalid ID format: ${id1}`);
  assert.match(id2, /^BZ-ERR-[2-9A-Z]{6}$/, `Invalid ID format: ${id2}`);
  assert.notStrictEqual(id1, id2, "Subsequent error IDs should be unique");
});

test("9.2: Error Reference ID contains zero sensitive information", async () => {
  const { generateErrorReferenceId } = await import("../lib/error-id.js");
  for (let i = 0; i < 50; i++) {
    const id = generateErrorReferenceId();
    assert.strictEqual(id.includes("@"), false);
    assert.strictEqual(id.includes("order"), false);
    assert.strictEqual(id.includes("secret"), false);
  }
});

// --- TEST 10: Security & Secret Leakage Audit ---
console.log("\n--- 10. Security & Secret Leakage Audit ---");

test("10.1: Error boundary files do not leak server secrets", () => {
  const files = [
    path.join(ROOT, "app", "error.js"),
    path.join(ROOT, "app", "global-error.js"),
    path.join(ROOT, "app", "not-found.js"),
    path.join(ROOT, "lib", "error-id.js"),
  ];
  const forbiddenPatterns = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "PHONEPE_SALT_KEY",
    "RESEND_API_KEY",
    "ORDER_VERIFICATION_SECRET",
    "ADMIN_SESSION_SECRET",
  ];
  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    for (const pattern of forbiddenPatterns) {
      assert.strictEqual(content.includes(pattern), false, `${f} contains forbidden secret reference: ${pattern}`);
    }
  }
});

test("10.2: Zero error or checkout paths redirect to accounts.google.com", () => {
  const appDir = path.join(ROOT, "app");
  function checkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(fullPath);
      } else if (entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) {
        const content = fs.readFileSync(fullPath, "utf8");
        assert.strictEqual(
          content.includes("accounts.google.com"),
          false,
          `Found accounts.google.com in ${fullPath}`
        );
      }
    }
  }
  checkDir(appDir);
});

console.log("\n============================================================");
console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
console.log("============================================================\n");

if (failed > 0) {
  process.exit(1);
}
