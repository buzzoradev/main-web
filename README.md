# Buzzora — Raw Honey from the Valleys of Jammu & Kashmir

E-commerce website for **Buzzora**, founded by Kannu Priya. From hive to jar —
nothing added, nothing taken away.

Built with **Next.js 14 (App Router) + Tailwind CSS**, designed to deploy on
**Vercel** with the business's existing domain.

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
```

## What's included (MVP)

- **Home** — hero, product highlights, honey finder quiz, brand statement,
  hive-to-jar timeline, J&K origin story, journal preview, Instagram + wholesale CTAs
- **/shop** — product grid with honey-type filter and price sorting
- **/products/[slug]** — size selection, quantity, Add to Cart / Buy Now
  (sticky on mobile), detail accordions, related products, Product JSON-LD
- **Cart drawer** — persisted in localStorage
- **/checkout** — shipping form + order summary; orders are validated and
  priced **server-side** (`app/api/orders`) and never trust client totals
- **/order-success** — order confirmation
- **/about**, **/hive-to-jar**, **/journal** (+ 5 articles), **/wholesale**
- WhatsApp floating button (renders only when a real number is configured)
- Organization / Product / Article structured data, per-page metadata, sitemap

## Before launch — placeholders to replace

All placeholder data lives in `lib/products.js` and is clearly marked:

- **Prices, weights, SKUs, stock** — currently placeholder values
- **Shipping rules** — `app/api/orders/route.js` (currently ₹0 / "confirmed with order")
- **WhatsApp number / contact email / domain** — set via `.env.local` (see `.env.example`)
- **Product & brand photography** — the illustrated jar (`components/JarVisual.jsx`)
  is a stand-in until real photos are added
- **Customer reviews** — intentionally omitted until genuine reviews exist

No certifications, health claims, or statistics have been invented anywhere.

## Checkout & payments

The checkout adapts to what's configured, so it works on static hosting today
and upgrades to full online payments when you move to a server host:

### 1. WhatsApp orders (works on GitHub Pages — no server)

Set `NEXT_PUBLIC_WHATSAPP_NUMBER` (international format, digits only, e.g.
`9199XXXXXXXX`). The checkout button becomes **Order via WhatsApp**: it builds
the order, opens WhatsApp pre-filled with the items, totals and shipping
address ready to send to you, and shows a confirmation page. You then confirm
payment (UPI / bank transfer / COD) and delivery directly with the customer.

On GitHub Pages, set it as a repo **Variable** named `WHATSAPP_NUMBER`
(Settings → Secrets and variables → Actions → Variables). The deploy workflow
reads it — no code change, nothing secret committed. `CONTACT_EMAIL` works the
same way and adds an email fallback.

### 2. Online card/UPI payments via Razorpay (needs a server — e.g. Vercel)

Set `NEXT_PUBLIC_PAYMENT_PROVIDER=razorpay` and the Razorpay keys. The checkout
button becomes **Pay** and runs the hosted Razorpay flow:

- `app/api/razorpay/order` creates the order with the amount computed
  **server-side** from the catalogue (client totals are never trusted)
- `app/api/razorpay/verify` verifies the payment **signature** server-side
  before the order is marked paid — a forged client success can't slip through
- `app/api/razorpay/webhook` is the authoritative confirmation (set the
  endpoint + `RAZORPAY_WEBHOOK_SECRET` in the Razorpay dashboard)

Card details never touch this codebase — Razorpay's hosted checkout handles
them. GitHub Pages can't run these API routes, so online payment requires
Vercel (or any Node server).

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Add the env vars from `.env.example` in Vercel → Project → Settings →
   Environment Variables.
3. Add the existing domain under Settings → Domains; point DNS as instructed
   (A/ALIAS for apex, CNAME for `www`). Choose one canonical host — Vercel
   automatically redirects the other. HTTPS is provisioned automatically.
4. Set `NEXT_PUBLIC_SITE_URL` to the canonical URL and redeploy.
