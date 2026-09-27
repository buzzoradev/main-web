/**
 * BUZZORA CHECKOUT VALIDATION & NORMALIZATION ENGINE
 *
 * Enforces strict, consistent client-side and server-side customer shipping validation.
 * Guaranteed:
 * - NO empty or whitespace-only values permitted
 * - Accurate normalization (trimming, lowercase email, clean digits)
 * - Indian phone & 6-digit PIN code formatting
 * - Trivial address rejection (protects fulfillment logistics)
 * - Zero database mutations or payment initiations on invalid data
 */

const DUMMY_ADDRESS_PATTERN = /^(test|none|null|na|n\/a|asdf|qwerty|12345|xyz|\.+)$/i;

/**
 * Normalizes customer shipping data safely.
 * @param {Object} input - Raw customer object
 * @returns {Object} Cleaned, trimmed customer object
 */
export function normalizeCustomerCheckout(input = {}) {
  const raw = typeof input === "object" && input !== null ? input : {};

  // Clean phone: keep digits and optional leading +
  let rawPhone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  let cleanPhone = rawPhone.replace(/[\s\-()]/g, "");

  // Clean PIN: strip any interior whitespace
  let cleanPostcode = typeof raw.postcode === "string" ? raw.postcode.trim().replace(/\s+/g, "") : "";

  return {
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "",
    phone: cleanPhone,
    address: typeof raw.address === "string" ? raw.address.trim() : "",
    city: typeof raw.city === "string" ? raw.city.trim() : "",
    state: typeof raw.state === "string" ? raw.state.trim() : "",
    postcode: cleanPostcode,
    country: typeof raw.country === "string" && raw.country.trim() ? raw.country.trim() : "India",
  };
}

/**
 * Validates a customer checkout payload.
 *
 * @param {Object} rawCustomer - Input customer object (before or after normalization)
 * @returns {{ isValid: boolean, errors: Record<string, string>, firstError: string | null, normalized: Object }}
 */
export function validateCustomerCheckout(rawCustomer) {
  const customer = normalizeCustomerCheckout(rawCustomer);
  const errors = {};

  // 1. Full Name
  if (!customer.name) {
    errors.name = "Please enter your full name.";
  } else if (customer.name.length < 2) {
    errors.name = "Please enter your complete full name.";
  }

  // 2. Email Address
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!customer.email) {
    errors.email = "Please enter your email address.";
  } else if (!emailRegex.test(customer.email) || customer.email.length > 254) {
    errors.email = "Please enter a valid email address.";
  }

  // 3. Phone Number (Indian mobile format: 10 digits starting 6-9, optional +91/91/0 prefix)
  const phoneDigits = customer.phone.replace(/\D/g, "");
  const isIndianFormat = /^(?:(?:\+?91)|0)?([6-9]\d{9})$/.test(customer.phone);
  const isAllSameDigit = phoneDigits.length >= 10 && /^(\d)\1+$/.test(phoneDigits);

  if (!customer.phone) {
    errors.phone = "Please enter your phone number.";
  } else if (!isIndianFormat || isAllSameDigit) {
    errors.phone = "Please enter a valid phone number.";
  }

  // 4. Street Address (Must have substance for delivery; reject dummy/trivial values)
  if (!customer.address) {
    errors.address = "Please enter your complete street address.";
  } else if (
    customer.address.length < 5 ||
    DUMMY_ADDRESS_PATTERN.test(customer.address) ||
    !/[a-zA-Z]/.test(customer.address)
  ) {
    errors.address = "Please enter your complete street address.";
  }

  // 5. City
  if (!customer.city) {
    errors.city = "Please enter your city.";
  } else if (customer.city.length < 2) {
    errors.city = "Please enter your city.";
  }

  // 6. State
  if (!customer.state) {
    errors.state = "Please enter your state.";
  } else if (customer.state.length < 2) {
    errors.state = "Please enter your state.";
  }

  // 7. Postcode / PIN Code (India 6-digit postal code, standard 100000 - 999999)
  const pinRegex = /^[1-9][0-9]{5}$/;
  if (!customer.postcode) {
    errors.postcode = "Please enter your PIN code.";
  } else if (!pinRegex.test(customer.postcode)) {
    errors.postcode = "Please enter a valid PIN code.";
  }

  // 8. Country
  if (!customer.country) {
    errors.country = "Please select your country.";
  }

  const errorKeys = Object.keys(errors);
  const isValid = errorKeys.length === 0;
  const firstError = isValid ? null : errors[errorKeys[0]];

  return {
    isValid,
    errors,
    firstError,
    normalized: customer,
  };
}
