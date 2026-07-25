// Client-side Razorpay checkout helper. Loads the hosted checkout script on
// demand and runs the full create → pay → verify flow against our own API
// routes (app/api/razorpay/*). Payment success is confirmed server-side by
// signature verification — the client success callback alone is never trusted.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function loadScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment gateway."));
    document.body.appendChild(s);
  });
}

// Returns the verified order on success, or throws.
export async function payWithRazorpay({ items, customer }) {
  await loadScript();

  const createRes = await fetch(`${BASE}/api/razorpay/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created.error || "Could not start payment.");

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: created.keyId,
      amount: created.amount,
      currency: created.currency,
      name: "Buzzora",
      description: "Raw honey from Jammu & Kashmir",
      order_id: created.orderId,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone,
      },
      theme: { color: "#E8A82B" },
      handler: async (response) => {
        try {
          const verifyRes = await fetch(`${BASE}/api/razorpay/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              items,
            }),
          });
          const verified = await verifyRes.json();
          if (!verifyRes.ok || !verified.verified) {
            throw new Error("We couldn't verify your payment. If you were charged, contact us and we'll sort it out.");
          }
          resolve(verified.order);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled.")),
      },
    });
    rzp.on("payment.failed", (resp) =>
      reject(new Error(resp?.error?.description || "Payment failed."))
    );
    rzp.open();
  });
}
