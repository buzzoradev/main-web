import Link from "next/link";
import { PolicyLayout, PolicySection } from "../_components";

export const metadata = { title: "Refund & Cancellation Policy", description: "Buzzora refund and cancellation policy." };

export default function RefundCancellationPage() {
  return (
    <PolicyLayout title="Refund & Cancellation Policy" intro="How Buzzora handles order cancellations, damaged goods, returns, and refunds for raw honey orders.">
      <PolicySection title="Business Identity">
        <p>This Refund &amp; Cancellation Policy applies to orders placed through Buzzora.co.in (Platform), owned and operated by <strong>Kannu Priya</strong>, a sole proprietorship operating under the trade/brand name <strong>Buzzora</strong> (referred to as &quot;Buzzora&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).</p>
        <p>Please review this policy alongside our <Link href="/policies/terms-and-conditions" className="underline text-honey-700 font-semibold">Terms &amp; Conditions</Link>, <Link href="/policies/privacy-policy" className="underline text-honey-700 font-semibold">Privacy Policy</Link>, <Link href="/policies/shipping-policy" className="underline text-honey-700 font-semibold">Shipping Policy</Link>, and <Link href="/policies/return-policy" className="underline text-honey-700 font-semibold">Return Policy</Link>.</p>
      </PolicySection>

      <PolicySection title="Order Cancellation">
        <p>Customers may request to cancel an order prior to its processing and dispatch by contacting us as soon as possible.</p>
        <p>Once an order has been handed over to our courier partner or dispatched for delivery, cancellation is generally no longer possible. If you wish to cancel an order before dispatch, please notify us immediately via email at <a href="mailto:buzzora.dev@gmail.com" className="underline text-honey-700">buzzora.dev@gmail.com</a>, call/WhatsApp at <strong>+91 9186009531</strong>, or submit an enquiry through our <Link href="/contact" className="underline text-honey-700">Contact Us Page</Link>.</p>
      </PolicySection>

      <PolicySection title="Cancellation Refunds">
        <p>When a cancellation request is submitted and approved prior to dispatch, any payment captured for the order will be refunded.</p>
        <p>Eligible refunds will be initiated within a reasonable processing period after cancellation approval. Refund timelines depend on the processing schedule of the third-party payment service provider or banking partner.</p>
      </PolicySection>

      <PolicySection title="Damaged, Leaked, or Defective Products">
        <p>Because raw honey is packed in glass or sealed food containers, we take great care in packaging. If your shipment arrives damaged, leaking, broken, or materially defective, please inform us promptly (preferably within 5 days of delivery).</p>
        <p>To help us resolve the issue quickly, please provide:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li>Your Buzzora Order Reference Number.</li>
          <li>Clear photographs showing the outer damaged parcel and shipping label.</li>
          <li>Clear photographs showing the affected honey jar/container and leakage.</li>
          <li>A brief description of the issue.</li>
        </ul>
        <p className="mt-2">Once verified, Buzzora will arrange an appropriate resolution, such as a replacement dispatch or refund.</p>
      </PolicySection>

      <PolicySection title="Incorrect Products Delivered">
        <p>If you receive a product that is different from what you ordered (wrong honey variant, size, or quantity), please contact us within 5 days of delivery with your order details and photos of the received items.</p>
        <p>Upon verification, Buzzora will correct the error by dispatching the correct item or processing a refund for the affected products.</p>
      </PolicySection>

      <PolicySection title="Returns of Food Products">
        <p>For health, hygiene, and food safety reasons, opened or unsealed jars of honey cannot be accepted for return or exchange once delivered unless they arrived damaged, leaked, or incorrect upon delivery.</p>
        <p>Unopened and sealed items in their original packaging may be reviewed for returns/exchanges in accordance with our <Link href="/policies/return-policy" className="underline text-honey-700 font-semibold">Return Policy</Link>.</p>
      </PolicySection>

      <PolicySection title="Refund Eligibility & Non-Refundable Situations">
        <p>Refunds may be considered in the following circumstances:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li>Order cancelled and approved prior to dispatch.</li>
          <li>Confirmed damaged, broken, or severely leaked package upon delivery.</li>
          <li>Confirmed delivery of an incorrect product or quantity.</li>
          <li>Confirmed non-delivery due to courier error or unfulfillment by Buzzora.</li>
        </ul>
        <p className="mt-3">Refunds are generally not applicable for:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li>Incorrect shipping address or recipient contact details provided by the customer.</li>
          <li>Customer unavailability or unannounced refusal of delivery at the doorstep.</li>
          <li>Change of mind after the food product has been delivered and opened.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Payment Issues & Failed Transactions">
        <p>If you experience payment issues during checkout:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li><strong>Failed Transactions (No Deduction):</strong> If payment fails and no amount is captured, you may re-attempt payment or place a new order.</li>
          <li><strong>Pending Confirmation (Amount Deducted):</strong> If funds are debited from your account but order confirmation is delayed, please contact us with your payment transaction ID. We will verify the status with our third-party payment provider before processing your order.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Refund Method & Security Notice">
        <p>Approved refunds will generally be issued back to the original payment method or bank account used for the transaction, subject to payment gateway policies.</p>
        <p className="mt-2 font-semibold text-charcoal">Security Notice:</p>
        <p className="text-charcoal-mute">Buzzora will <strong>NEVER</strong> ask customers for One-Time Passwords (OTPs), bank PINs, CVVs, or account login passwords to process a refund. Please do not share sensitive banking credentials with anyone.</p>
      </PolicySection>

      <PolicySection title="Shipping Delays & Issues">
        <p>If your package is significantly delayed or marked delivered by the courier but not received, please contact us promptly. For more information regarding delivery schedules, please visit our <Link href="/policies/shipping-policy" className="underline text-honey-700 font-semibold">Shipping Policy</Link>.</p>
      </PolicySection>

      <PolicySection title="Contact Information">
        <p>For refund, cancellation, or order queries, please reach out to us:</p>
        <ul className="mt-2 space-y-1 text-sm text-charcoal-mute">
          <li><strong>Trade / Brand Name:</strong> Buzzora</li>
          <li><strong>Legal Proprietor:</strong> Kannu Priya (Sole Proprietorship)</li>
          <li><strong>Registered Business Address:</strong> Near Govt Middle School, Janglote Kathua Tehsil, Kathua, Kathua, Jammu &amp; Kashmir - 184104</li>
          <li><strong>Business Email:</strong> <a href="mailto:buzzora.dev@gmail.com" className="underline text-honey-700">buzzora.dev@gmail.com</a></li>
          <li><strong>Business Phone:</strong> <a href="https://wa.me/919186009531" target="_blank" rel="noopener noreferrer" className="underline text-honey-700">+91 9186009531</a></li>
          <li><strong>Contact Form:</strong> <Link href="/contact" className="underline text-honey-700">Contact Us Page</Link></li>
        </ul>
      </PolicySection>
    </PolicyLayout>
  );
}
