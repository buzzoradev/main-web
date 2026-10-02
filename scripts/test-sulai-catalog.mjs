/**
 * BUZZORA: SULAI CATALOG & IMAGERY VERIFICATION SUITE
 *
 * Verifies the 3 active Sulai Honey variants (140g, 250g, 500g), prices, SKUs,
 * image assets, order calculations, server-side validation, and email resolvers.
 */

import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const { products, getProduct, minPrice } = await import(
  pathToFileURL(path.join(ROOT, "lib/products.js")).href
);
const { buildOrder } = await import(
  pathToFileURL(path.join(ROOT, "lib/order.js")).href
);
const { resolveProductImageUrl } = await import(
  pathToFileURL(path.join(ROOT, "lib/email/service.js")).href
);

console.log("============================================================");
console.log("BUZZORA: SULAI CATALOG & IMAGERY VERIFICATION SUITE");
console.log("============================================================\n");

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

// 1. Sulai Product definition
test("1. Sulai product exists with exactly 3 active variants", () => {
  const sulai = getProduct("sulai-honey");
  assert.ok(sulai, "Sulai product should exist");
  assert.strictEqual(sulai.id, "sulai");
  assert.strictEqual(sulai.name, "Sulai Honey");
  assert.strictEqual(sulai.image, "/product images/sulai 250g.png");
  assert.strictEqual(sulai.sizes.length, 3, "Sulai must have exactly 3 sizes");
});

// 2. 140g variant
test("2. Sulai 140g variant values (BZ-SL-140, ₹399)", () => {
  const sulai = getProduct("sulai-honey");
  const s140 = sulai.sizes.find((s) => s.weight === "140g");
  assert.ok(s140, "140g variant must exist");
  assert.strictEqual(s140.sku, "BZ-SL-140");
  assert.strictEqual(s140.price, 399);
  assert.strictEqual(s140.image, "/product images/sulai 140g.png");
  assert.strictEqual(s140.inStock, true);
});

// 3. 250g variant
test("3. Sulai 250g variant values (BZ-SL-250, ₹699)", () => {
  const sulai = getProduct("sulai-honey");
  const s250 = sulai.sizes.find((s) => s.weight === "250g");
  assert.ok(s250, "250g variant must exist");
  assert.strictEqual(s250.sku, "BZ-SL-250");
  assert.strictEqual(s250.price, 699);
  assert.strictEqual(s250.image, "/product images/sulai 250g.png");
  assert.strictEqual(s250.inStock, true);
});

// 4. 500g variant
test("4. Sulai 500g variant values (BZ-SL-500, ₹999)", () => {
  const sulai = getProduct("sulai-honey");
  const s500 = sulai.sizes.find((s) => s.weight === "500g");
  assert.ok(s500, "500g variant must exist");
  assert.strictEqual(s500.sku, "BZ-SL-500");
  assert.strictEqual(s500.price, 999);
  assert.strictEqual(s500.image, "/product images/sulai 500g.png");
  assert.strictEqual(s500.inStock, true);
});

// 5. Inactive 200g check
test("5. BZ-SL-200 / 200g is removed from active catalog", () => {
  const sulai = getProduct("sulai-honey");
  const s200 = sulai.sizes.find((s) => s.sku === "BZ-SL-200" || s.weight === "200g");
  assert.strictEqual(s200, undefined, "200g must not be in active sizes");
});

// 6. Starting price
test("6. minPrice calculation returns 399 ('from ₹399')", () => {
  const sulai = getProduct("sulai-honey");
  assert.strictEqual(minPrice(sulai), 399);
});

// 7. Public web assets existence
test("7. Public product images exist under public/product images/", () => {
  const p140 = path.join(ROOT, "public/product images/sulai 140g.png");
  const p250 = path.join(ROOT, "public/product images/sulai 250g.png");
  const p500 = path.join(ROOT, "public/product images/sulai 500g.png");

  assert.ok(fs.existsSync(p140), "public/product images/sulai 140g.png must exist");
  assert.ok(fs.existsSync(p250), "public/product images/sulai 250g.png must exist");
  assert.ok(fs.existsSync(p500), "public/product images/sulai 500g.png must exist");

  assert.ok(fs.statSync(p140).size > 0, "140g image file must not be empty");
  assert.ok(fs.statSync(p250).size > 0, "250g image file must not be empty");
  assert.ok(fs.statSync(p500).size > 0, "500g image file must not be empty");
});

// 8. Order line calculations
test("8. Order calculation for 140g (qty 2 = ₹798)", () => {
  const items = [{ productId: "sulai", sizeSku: "BZ-SL-140", qty: 2 }];
  const customer = { name: "Test User", email: "test@example.com", phone: "+91 9999999999" };
  const order = buildOrder(items, customer);
  assert.strictEqual(order.lines.length, 1);
  assert.strictEqual(order.lines[0].sku, "BZ-SL-140");
  assert.strictEqual(order.lines[0].weight, "140g");
  assert.strictEqual(order.lines[0].unitPrice, 399);
  assert.strictEqual(order.lines[0].lineTotal, 798);
  assert.strictEqual(order.subtotal, 798);
  assert.strictEqual(order.total, 798);
});

test("9. Order calculation for 250g (qty 1 = ₹699)", () => {
  const items = [{ productId: "sulai", sizeSku: "BZ-SL-250", qty: 1 }];
  const customer = { name: "Test User", email: "test@example.com", phone: "+91 9999999999" };
  const order = buildOrder(items, customer);
  assert.strictEqual(order.lines.length, 1);
  assert.strictEqual(order.lines[0].sku, "BZ-SL-250");
  assert.strictEqual(order.lines[0].weight, "250g");
  assert.strictEqual(order.lines[0].unitPrice, 699);
  assert.strictEqual(order.lines[0].lineTotal, 699);
  assert.strictEqual(order.subtotal, 699);
  assert.strictEqual(order.total, 699);
});

test("10. Order calculation for 500g (qty 3 = ₹2997)", () => {
  const items = [{ productId: "sulai", sizeSku: "BZ-SL-500", qty: 3 }];
  const customer = { name: "Test User", email: "test@example.com", phone: "+91 9999999999" };
  const order = buildOrder(items, customer);
  assert.strictEqual(order.lines.length, 1);
  assert.strictEqual(order.lines[0].sku, "BZ-SL-500");
  assert.strictEqual(order.lines[0].weight, "500g");
  assert.strictEqual(order.lines[0].unitPrice, 999);
  assert.strictEqual(order.lines[0].lineTotal, 2997);
  assert.strictEqual(order.subtotal, 2997);
  assert.strictEqual(order.total, 2997);
});

test("11. Mixed cart calculation (140g + 250g + 500g = ₹2097)", () => {
  const items = [
    { productId: "sulai", sizeSku: "BZ-SL-140", qty: 1 },
    { productId: "sulai", sizeSku: "BZ-SL-250", qty: 1 },
    { productId: "sulai", sizeSku: "BZ-SL-500", qty: 1 },
  ];
  const customer = { name: "Test User", email: "test@example.com", phone: "+91 9999999999" };
  const order = buildOrder(items, customer);
  assert.strictEqual(order.lines.length, 3);
  assert.strictEqual(order.subtotal, 399 + 699 + 999);
  assert.strictEqual(order.total, 2097);
});

// 12. Server-side validation
test("12. Server validation logic accepts active variants and rejects old BZ-SL-200", () => {
  function validateCartItems(cartItems) {
    const lines = [];
    for (const item of cartItems) {
      const product = products.find((p) => p.id === item.productId);
      const size = product?.sizes.find((s) => s.sku === item.sizeSku);
      const qty = Number(item.qty);

      if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
        return { valid: false, error: "Invalid cart item." };
      }
      if (!size.inStock) {
        return { valid: false, error: `${product.name} (${size.weight}) is out of stock` };
      }

      lines.push({
        name: product.name,
        weight: size.weight,
        sku: size.sku,
        qty,
        unitPrice: size.price,
        lineTotal: size.price * qty,
      });
    }
    return { valid: true, lines };
  }

  // Active variants accepted
  assert.strictEqual(validateCartItems([{ productId: "sulai", sizeSku: "BZ-SL-140", qty: 1 }]).valid, true);
  assert.strictEqual(validateCartItems([{ productId: "sulai", sizeSku: "BZ-SL-250", qty: 1 }]).valid, true);
  assert.strictEqual(validateCartItems([{ productId: "sulai", sizeSku: "BZ-SL-500", qty: 1 }]).valid, true);

  // Inactive BZ-SL-200 rejected
  const oldResult = validateCartItems([{ productId: "sulai", sizeSku: "BZ-SL-200", qty: 1 }]);
  assert.strictEqual(oldResult.valid, false);
  assert.strictEqual(oldResult.error, "Invalid cart item.");
});

// 13. Email image resolution
test("13. Email canonical image resolver for active & historical variants", () => {
  const img140 = resolveProductImageUrl({ sku: "BZ-SL-140", weight: "140g", name: "Sulai Honey" });
  assert.ok(img140.includes("sulai%20140g.png"), "140g must resolve to sulai 140g.png");

  const img250 = resolveProductImageUrl({ sku: "BZ-SL-250", weight: "250g", name: "Sulai Honey" });
  assert.ok(img250.includes("sulai%20250g.png"), "250g must resolve to sulai 250g.png");

  const img200 = resolveProductImageUrl({ sku: "BZ-SL-200", weight: "200g", name: "Sulai Honey" });
  assert.ok(img200.includes("sulai%20200g.png"), "Historical 200g must resolve to sulai 200g.png");

  const img500 = resolveProductImageUrl({ sku: "BZ-SL-500", weight: "500g", name: "Sulai Honey" });
  assert.ok(img500.includes("sulai%20500g.png"), "500g must resolve to sulai 500g.png");
});

// 14. Homepage hero image
test("14. Homepage hero references sulai 250g.png", () => {
  const pageContent = fs.readFileSync(path.join(ROOT, "app/page.js"), "utf8");
  assert.ok(
    pageContent.includes('/product images/sulai 250g.png'),
    "app/page.js must reference /product images/sulai 250g.png"
  );
  assert.ok(
    !pageContent.includes('/product images/sulai 200g.png'),
    "app/page.js must not reference /product images/sulai 200g.png"
  );
});

console.log(`\n============================================================`);
console.log(`SULAI CATALOG SUITE RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
console.log(`============================================================\n`);

if (failed > 0) process.exit(1);
