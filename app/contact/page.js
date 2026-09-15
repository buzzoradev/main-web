"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";

export default function ContactPage() {
  const [form, setForm] = useState({});
  const [sent, setSent] = useState(false);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = [
      `Name: ${form.name || ""}`,
      `Email: ${form.email || ""}`,
      `Phone: ${form.phone || ""}`,
      `Subject: ${form.subject || "General Enquiry"}`,
      "",
      form.message || "",
    ].join("\n");
    window.location.href = `mailto:buzzora.dev@gmail.com?subject=${encodeURIComponent(
      form.subject || "Contact Enquiry — Buzzora"
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <main className="pb-24 pt-28 md:pt-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow">Contact Us</p>
            <h1 className="mt-3 font-display text-5xl sm:text-6xl text-charcoal">Get in Touch</h1>
            <p className="mt-4 text-base leading-relaxed text-charcoal-mute">
              Have a question about our raw honey, orders, or wholesale partnerships? Reach out to us directly or fill in the form below.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          {/* Left Column: Business & Contact Details */}
          <div className="space-y-6 lg:col-span-5">
            <Reveal>
              <div className="rounded-4xl border border-charcoal/10 bg-white p-7 shadow-soft space-y-6">
                <div>
                  <h2 className="font-display text-2xl text-charcoal">Business Information</h2>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-honey-700">Official Identity</p>
                </div>

                <dl className="space-y-4 text-sm">
                  <div className="border-b border-charcoal/5 pb-3">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Brand / Trade Name</dt>
                    <dd className="mt-1 text-base font-semibold text-charcoal">Buzzora</dd>
                  </div>

                  <div className="border-b border-charcoal/5 pb-3">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Legal Owner</dt>
                    <dd className="mt-1 text-base font-semibold text-charcoal">Kannu Priya</dd>
                  </div>

                  <div className="border-b border-charcoal/5 pb-3">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Business Type</dt>
                    <dd className="mt-1 text-base font-medium text-charcoal">Sole Proprietorship</dd>
                  </div>

                  <div className="border-b border-charcoal/5 pb-3">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Registered Business Address</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-charcoal">
                      Near Govt Middle School, Janglote Kathua Tehsil, Kathua, Kathua, Jammu &amp; Kashmir - 184104
                    </dd>
                  </div>
                </dl>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="rounded-4xl border border-charcoal/10 bg-white p-7 shadow-soft space-y-5">
                <h3 className="font-display text-xl text-charcoal">Direct Contact</h3>

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-honey-100 text-honey-700">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M22 6l-10 7L2 6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Email Us</p>
                      <a href="mailto:buzzora.dev@gmail.com" className="font-medium text-charcoal hover:text-honey-700 underline">
                        buzzora.dev@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-honey-100 text-honey-700">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Call / WhatsApp</p>
                      <a href="https://wa.me/919186009531" target="_blank" rel="noopener noreferrer" className="font-medium text-charcoal hover:text-honey-700 underline">
                        +91 9186009531
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-honey-100 text-honey-700">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Support Hours</p>
                      <p className="text-charcoal-soft">Monday – Friday (9:00 AM – 6:00 PM IST)</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Interactive Form */}
          <div className="lg:col-span-7">
            <Reveal delay={150}>
              <div className="rounded-4xl border border-charcoal/10 bg-white p-7 sm:p-10 shadow-soft">
                <h2 className="font-display text-3xl text-charcoal">Send Us a Message</h2>
                <p className="mt-2 text-sm text-charcoal-mute">Fill in your details and we will respond as soon as possible.</p>

                {sent ? (
                  <div className="mt-8 rounded-3xl bg-honey-100/70 p-8 text-center">
                    <p className="text-4xl">🐝</p>
                    <p className="mt-3 font-display text-2xl text-charcoal">Thank You!</p>
                    <p className="mt-2 text-sm text-charcoal-mute">
                      Your message draft has been prepared. If your email app didn&apos;t open automatically, feel free to write to us directly at{" "}
                      <a href="mailto:buzzora.dev@gmail.com" className="font-semibold text-honey-700 underline">
                        buzzora.dev@gmail.com
                      </a>.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Your Name</span>
                        <input
                          required
                          type="text"
                          className="input"
                          placeholder="e.g. Rahul Sharma"
                          value={form.name || ""}
                          onChange={set("name")}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Email Address</span>
                        <input
                          required
                          type="email"
                          className="input"
                          placeholder="e.g. rahul@example.com"
                          value={form.email || ""}
                          onChange={set("email")}
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Phone Number</span>
                        <input
                          type="tel"
                          className="input"
                          placeholder="e.g. +91 98765 43210"
                          value={form.phone || ""}
                          onChange={set("phone")}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Subject</span>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Order Enquiry / Product Question"
                          value={form.subject || ""}
                          onChange={set("subject")}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal-mute">Message</span>
                      <textarea
                        required
                        rows={5}
                        className="input resize-y"
                        placeholder="How can we help you today?"
                        value={form.message || ""}
                        onChange={set("message")}
                      />
                    </label>

                    <button type="submit" className="btn-primary mt-4 w-full sm:w-auto">
                      Send Message
                    </button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </main>
  );
}
