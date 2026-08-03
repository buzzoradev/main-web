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

export async function payWithPhonePe({ items, customer }) {
  await loadScript();
  const createResponse = await fetch(`${BASE}/api/phonepe/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) throw new Error(created.error || "Could not start PhonePe payment.");

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    const checkStatus = async () => {
      const statusResponse = await fetch(`${BASE}/api/phonepe/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantOrderId: created.merchantOrderId, items, customer }),
      });
      const status = await statusResponse.json();
      if (!statusResponse.ok || !status.paid) throw new Error("PhonePe payment was not completed.");
      return status.order;
    };

    try {
      window.PhonePeCheckout.transact({
        tokenUrl: created.tokenUrl,
        callback: async (response) => {
          if (response === "USER_CANCEL") return finish(reject)(new Error("Payment cancelled."));
          if (response !== "CONCLUDED") return;
          try {
            finish(resolve)(await checkStatus());
          } catch (error) {
            finish(reject)(error);
          }
        },
        type: "IFRAME",
      });
    } catch (error) {
      finish(reject)(error);
    }
  });
}
