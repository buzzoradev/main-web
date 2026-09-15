const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function loadScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.PhonePeCheckout) return resolve();
    const script = document.createElement("script");
    script.src = "https://mercury.phonepe.com/web/bundle/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load PhonePe checkout."));
    document.body.appendChild(script);
  });
}

/**
 * Initiates PhonePe Standard Checkout for an existing persistent Buzzora Order ID.
 *
 * @param {Object} params
 * @param {string} params.buzzoraOrderId - Persistent Buzzora Order ID (e.g. BZ-XXXXXXXX-XXXX)
 */
export async function payWithPhonePe({ buzzoraOrderId }) {
  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string") {
    throw new Error("Missing or invalid buzzoraOrderId for PhonePe payment.");
  }

  await loadScript();

  // Call POST /api/phonepe/order passing ONLY buzzoraOrderId
  const createResponse = await fetch(`${BASE}/api/phonepe/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buzzoraOrderId }),
  });

  const created = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(created.error || "Could not start PhonePe payment.");
  }

  const { tokenUrl, redirectUrl, merchantOrderId } = created;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    try {
      window.PhonePeCheckout.transact({
        tokenUrl: tokenUrl || redirectUrl,
        callback: (response) => {
          if (response === "USER_CANCEL") {
            return finish(reject)(
              new Error("Payment was cancelled. Your order is saved and you can try again.")
            );
          }
          if (response === "CONCLUDED") {
            // SDK iframe concluded. Navigate browser to server callback route for verification.
            const callbackUrl = `${BASE}/api/phonepe/callback?merchantOrderId=${encodeURIComponent(
              merchantOrderId
            )}`;
            window.location.href = callbackUrl;
            return;
          }
        },
        type: "IFRAME",
      });
    } catch (error) {
      finish(reject)(error);
    }
  });
}
