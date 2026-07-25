"use client";

import { useState } from "react";

// Wholesale enquiry form. Until a backend inbox/CRM is connected, submissions
// open a pre-filled email to the business address configured in env.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function WholesaleForm() {
  const [form, setForm] = useState({});
  const [sent, setSent] = useState(false);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const body = [
      `Name: ${form.name || ""}`,
      `Business: ${form.business || ""}`,
      `Email: ${form.email || ""}`,
      `Phone: ${form.phone || ""}`,
      "",
      form.message || "",
    ].join("\n");
    if (CONTACT_EMAIL) {
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        "Wholesale enquiry — " + (form.business || form.name || "")
      )}&body=${encodeURIComponent(body)}`;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="mt-10 rounded-4xl border border-charcoal/10 bg-white p-10 text-center">
        <p className="text-4xl">🐝</p>
        <p className="mt-3 font-display text-2xl">Thanks — we&apos;ll be in touch.</p>
        <p className="mt-2 text-sm text-charcoal-mute">
          {CONTACT_EMAIL
            ? "Your email app should have opened with your enquiry ready to send."
            : "You can also reach us any time on Instagram @_buzzora_."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-4xl border border-charcoal/10 bg-white p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">Name</span>
          <input required className="input" value={form.name || ""} onChange={set("name")} />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">Business name</span>
          <input required className="input" value={form.business || ""} onChange={set("business")} />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">Email</span>
          <input required type="email" className="input" value={form.email || ""} onChange={set("email")} />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">Phone</span>
          <input required type="tel" className="input" value={form.phone || ""} onChange={set("phone")} />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider2 text-charcoal-mute">Message</span>
          <textarea
            required
            rows={5}
            className="input resize-y"
            placeholder="Tell us about your business and what you're looking for…"
            value={form.message || ""}
            onChange={set("message")}
          />
        </label>
      </div>
      <button type="submit" className="btn-primary mt-6 w-full sm:w-auto">
        Send Enquiry
      </button>
    </form>
  );
}
