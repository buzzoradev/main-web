import { products } from "./products.js";

/**
 * Normalizes a coupon code: trims whitespace and converts to uppercase.
 * Rejects non-string and empty values.
 *
 * @param {string} code
 * @returns {string|null} Normalized uppercase coupon code or null if invalid
 */
export function normalizeCouponCode(code) {
  if (!code || typeof code !== "string") return null;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates a coupon record against the order subtotal and current timestamp.
 *
 * Evaluation Order:
 * 1. Coupon exists & is not soft-deleted
 * 2. Coupon is active (is_active === true)
 * 3. starts_at validation (current time >= starts_at)
 * 4. expires_at validation (current time < expires_at)
 * 5. usage_limit validation (usage_count < usage_limit)
 * 6. minimum_order_amount validation (subtotal >= minimum_order_amount)
 * 7. discount_percent validation (0 < discount_percent <= 100)
 *
 * @param {Object} coupon - Database coupon record
 * @param {number} subtotal - Authoritative reconstructed order subtotal (INR)
 * @param {Date} [now=new Date()] - Reference timestamp for time-based validity
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateCoupon(coupon, subtotal, now = new Date()) {
  if (!coupon || coupon.deleted_at) {
    return { isValid: false, error: "Invalid coupon code." };
  }

  if (!coupon.is_active) {
    return { isValid: false, error: "Coupon is not active." };
  }

  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (coupon.starts_at) {
    const startTime = new Date(coupon.starts_at).getTime();
    if (currentTime < startTime) {
      return { isValid: false, error: "Coupon is not valid yet." };
    }
  }

  if (coupon.expires_at) {
    const expireTime = new Date(coupon.expires_at).getTime();
    if (currentTime >= expireTime) {
      return { isValid: false, error: "Coupon has expired." };
    }
  }

  if (coupon.usage_limit != null) {
    const limit = Number(coupon.usage_limit);
    const count = Number(coupon.usage_count || 0);
    if (count >= limit) {
      return { isValid: false, error: "Coupon usage limit has been reached." };
    }
  }

  const numericSubtotal = Number(subtotal);
  if (coupon.minimum_order_amount != null) {
    const minAmount = Number(coupon.minimum_order_amount);
    if (numericSubtotal < minAmount) {
      return {
        isValid: false,
        error: `Minimum order value for this coupon is ₹${minAmount.toLocaleString("en-IN")}.`,
      };
    }
  }

  const discountPercent = Number(coupon.discount_percent);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return { isValid: false, error: "Invalid coupon discount percentage." };
  }

  return { isValid: true };
}

/**
 * Calculates discount amount and final payable total with 2 decimal precision.
 *
 * Formula:
 * - rawDiscount = round2(subtotal * (discount_percent / 100))
 * - cappedDiscount = maximum_discount_amount != null ? MIN(rawDiscount, maximum_discount_amount) : rawDiscount
 * - finalDiscount = MIN(cappedDiscount, subtotal)
 * - finalTotal = MAX(0, round2(subtotal + shipping - finalDiscount))
 *
 * @param {Object} params
 * @param {number} params.subtotal - Cart subtotal in INR
 * @param {number} [params.shippingCost=0] - Shipping cost in INR
 * @param {number} params.discountPercent - Coupon percentage (e.g. 10 for 10%)
 * @param {number|null} [params.maximumDiscountAmount=null] - Maximum discount cap in INR
 * @returns {{ discountAmount: number, finalTotal: number }}
 */
export function calculateCouponDiscount({
  subtotal,
  shippingCost = 0,
  discountPercent,
  maximumDiscountAmount = null,
}) {
  const cleanSubtotal = Math.max(0, Number(subtotal) || 0);
  const cleanShipping = Math.max(0, Number(shippingCost) || 0);
  const cleanPercent = Number(discountPercent) || 0;

  if (cleanPercent <= 0 || cleanSubtotal <= 0) {
    return {
      discountAmount: 0,
      finalTotal: Math.round((cleanSubtotal + cleanShipping) * 100) / 100,
    };
  }

  // Safe rounding to 2 decimal places to avoid floating-point drift
  const rawDiscount = Math.round(cleanSubtotal * (cleanPercent / 100) * 100) / 100;

  let discount = rawDiscount;
  if (maximumDiscountAmount != null && Number(maximumDiscountAmount) >= 0) {
    discount = Math.min(discount, Number(maximumDiscountAmount));
  }

  // Never allow discount to exceed subtotal
  discount = Math.min(discount, cleanSubtotal);
  discount = Math.round(discount * 100) / 100;

  const finalTotal = Math.max(0, Math.round((cleanSubtotal + cleanShipping - discount) * 100) / 100);

  return {
    discountAmount: discount,
    finalTotal,
  };
}

/**
 * Reconstructs line items and financial totals strictly from the authoritative server catalog.
 * Client-provided prices are completely discarded and never trusted.
 *
 * @param {Array<Object>} items - Array of { productId, sizeSku, qty }
 * @returns {{ isValid: boolean, error?: string, subtotal: number, shippingCost: number, lines: Array<Object>, itemsData: Array<Object> }}
 */
export function reconstructAuthoritativeCart(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return {
      isValid: false,
      error: "Cart must contain between 1 and 50 items.",
      subtotal: 0,
      shippingCost: 0,
      lines: [],
      itemsData: [],
    };
  }

  const lines = [];
  const itemsData = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId || p.slug === item.productId);
    const size = product?.sizes.find((s) => s.sku === item.sizeSku);
    const qty = Number(item.qty);

    if (!product || !size || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return {
        isValid: false,
        error: "Invalid cart item.",
        subtotal: 0,
        shippingCost: 0,
        lines: [],
        itemsData: [],
      };
    }

    if (!size.inStock) {
      return {
        isValid: false,
        error: `${product.name} (${size.weight}) is out of stock`,
        subtotal: 0,
        shippingCost: 0,
        lines: [],
        itemsData: [],
      };
    }

    const unitPrice = size.price;
    const lineTotal = unitPrice * qty;

    lines.push({
      productId: product.id,
      name: product.name,
      weight: size.weight,
      sku: size.sku,
      qty,
      unitPrice,
      lineTotal,
    });

    itemsData.push({
      product_id: product.id,
      product_name: product.name,
      size_sku: size.sku,
      weight: size.weight,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shippingCost = 0; // Buzzora standard online checkout is free shipping

  return {
    isValid: true,
    subtotal,
    shippingCost,
    lines,
    itemsData,
  };
}
