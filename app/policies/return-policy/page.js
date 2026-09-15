import Link from "next/link";
import { PolicyLayout, PolicySection } from "../_components";

export const metadata = { title: "Return Policy", description: "Buzzora return and exchange policy." };

export default function ReturnPolicyPage() {
  return (
    <PolicyLayout title="Return Policy" intro="Guidelines for product returns, replacements, and exchanges for Buzzora raw honey orders.">
      <PolicySection title="Business Identity">
        <p>This Return Policy applies to products purchased through Buzzora.co.in (Platform), owned and operated by <strong>Kannu Priya</strong>, a sole proprietorship operating under the trade/brand name <strong>Buzzora</strong> (referred to as &quot;Buzzora&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).</p>
        <p>Please review this policy alongside our <Link href="/policies/refund-cancellation" className="underline text-honey-700 font-semibold">Refund &amp; Cancellation Policy</Link>, <Link href="/policies/terms-and-conditions" className="underline text-honey-700 font-semibold">Terms &amp; Conditions</Link>, <Link href="/policies/privacy-policy" className="underline text-honey-700 font-semibold">Privacy Policy</Link>, and <Link href="/policies/shipping-policy" className="underline text-honey-700 font-semibold">Shipping Policy</Link>.</p>
      </PolicySection>

      <PolicySection title="Food Product Return Guidelines">
        <p>Buzzora specializes in raw honey and food products. For health, hygiene, and food safety standards, product return eligibility depends on the condition of the delivered item:</p>
        <ul className="list-disc pl-5 space-y-2 text-charcoal-mute">
          <li>
            <strong>Opened / Unsealed Products:</strong> Due to hygiene and food safety regulations, once a jar of honey has been opened, unsealed, or consumed, ordinary returns or exchanges cannot be accepted. However, if the product arrived damaged, leaked, or incorrect upon delivery, it will be reviewed for replacement or refund.
          </li>
          <li>
            <strong>Unopened / Sealed Products:</strong> If you receive an unopened, factory-sealed product and wish to request a return or exchange, please contact us promptly after receiving your delivery (within 5 days of delivery) for authorization.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="Damaged, Leaked, or Defective Goods">
        <p>If your package arrives damaged, leaking, broken, or tampered with during transit, please notify Buzzora promptly (preferably within 5 days of receiving the parcel).</p>
        <p>Please email or message us with the following details:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li>Buzzora Order Reference Number.</li>
          <li>Customer Name and contact details.</li>
          <li>Clear photographs showing the damaged outer parcel and shipping label.</li>
          <li>Clear photographs showing the leaking or broken honey jar.</li>
          <li>A brief description of the condition upon arrival.</li>
        </ul>
        <p className="mt-2">Once verified, we will arrange a replacement dispatch or process a refund.</p>
      </PolicySection>

      <PolicySection title="Incorrect Product Delivered">
        <p>If you receive a product different from what you ordered (wrong honey variant, weight, or quantity), please contact us within 5 days of delivery with your order reference number and photographs of the received items.</p>
        <p>Upon verification, Buzzora will correct the order by sending the correct replacement product or processing a refund for the affected item.</p>
      </PolicySection>

      <PolicySection title="Step-by-Step Return Request Process">
        <ol className="list-decimal pl-5 space-y-2 text-charcoal-mute">
          <li>
            <strong>Step 1 — Contact Support:</strong> Reach out to us via email at <a href="mailto:buzzora.dev@gmail.com" className="underline text-honey-700 font-semibold">buzzora.dev@gmail.com</a>, call/WhatsApp at <strong>+91 9186009531</strong>, or submit a request on our <Link href="/contact" className="underline text-honey-700 font-semibold">Contact Us Page</Link>.
          </li>
          <li>
            <strong>Step 2 — Provide Order Details:</strong> Share your order number, product name, description of the issue, and clear photos where applicable.
          </li>
          <li>
            <strong>Step 3 — Review:</strong> Buzzora will review your request and photos.
          </li>
          <li>
            <strong>Step 4 — Resolution:</strong> If approved, Buzzora will communicate instructions for replacement dispatch or refund processing.
          </li>
        </ol>
        <p className="mt-3 font-medium text-charcoal-dark">
          <em>Important: Please do not ship any food products back to our address without prior written approval and return instructions from Buzzora.</em>
        </p>
      </PolicySection>

      <PolicySection title="Return Shipping & Instructions">
        <p>Customers should not independently dispatch returned items without prior authorization from Buzzora. In confirmed cases of damaged delivery, leakage, or incorrect item dispatch, Buzzora will handle the replacement dispatch directly or provide return coordination instructions.</p>
      </PolicySection>

      <PolicySection title="Non-Returnable Situations">
        <p>Returns, refunds, or exchanges are not applicable under the following circumstances:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li>Food products that have been opened, unsealed, or used after delivery (except for verified damaged/leaked transit claims).</li>
          <li>Change of mind after the food product has been delivered.</li>
          <li>Orders delivered to an incorrect shipping address provided by the customer.</li>
          <li>Products damaged due to improper storage or mishandling by the customer after delivery.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Replacement or Refund Resolution">
        <p>Approved return issues will be resolved through a product replacement dispatch or refund depending on product availability and customer preference. For full details regarding refund methods and timelines, please consult our <Link href="/policies/refund-cancellation" className="underline text-honey-700 font-semibold">Refund &amp; Cancellation Policy</Link>.</p>
      </PolicySection>

      <PolicySection title="Payment Credentials Security Warning">
        <p className="font-semibold text-charcoal">Security Notice:</p>
        <p className="text-charcoal-mute">Buzzora will <strong>NEVER</strong> request passwords, bank PINs, CVV numbers, or One-Time Passwords (OTPs) to process a return or refund. Please protect your financial credentials.</p>
      </PolicySection>

      <PolicySection title="Contact Information">
        <p>For return enquiries or support, please reach out to us:</p>
        <ul className="mt-2 space-y-1 text-sm text-charcoal-mute">
          <li><strong>Trade / Brand Name:</strong> Buzzora</li>
          <li><strong>Legal Proprietor:</strong> Kannu Priya (Sole Proprietorship)</li>
          <li><strong>Registered Business Address:</strong> Near Govt Middle School, Janglote Kathua Tehsil, Kathua, Kathua, Jammu &amp; Kashmir - 184104</li>
          <li><strong>Business Email:</strong> <a href="mailto:buzzora.dev@gmail.com" className="underline text-honey-700">buzzora.dev@gmail.com</a></li>
          <li><strong>Business Phone:</strong> <a href="https://wa.me/919186009531" target="_blank" rel="noopener noreferrer" className="underline text-honey-700">+91 9186009531</a></li>
          <li><strong>Contact Page:</strong> <Link href="/contact" className="underline text-honey-700">Contact Us</Link></li>
        </ul>
      </PolicySection>
    </PolicyLayout>
  );
}
