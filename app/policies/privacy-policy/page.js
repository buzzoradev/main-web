import { PolicyLayout, PolicySection, PolicySubheading } from "../_components";

export const metadata = { title: "Privacy Policy", description: "Buzzora privacy policy." };

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout title="Privacy Policy" intro="How Buzzora collects, uses, shares, protects, and processes customer information through Buzzora.co.in.">
      <PolicySection>
        <PolicySubheading>Introduction</PolicySubheading>
        <p>This Privacy Policy describes how Kannu Priya, operating as a sole proprietorship under the trade/brand name Buzzora (collectively &quot;Buzzora&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;), collects, uses, shares, and protects your information when you visit or make a purchase through Buzzora.co.in (Platform).</p>
        <p>By visiting the Platform, submitting an order, or communicating with us, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree, please do not access or use the Platform.</p>
      </PolicySection>

      <PolicySection title="Information We Collect">
        <p>We collect information directly provided by customers during order placement, checkout, or customer support communications. This may include:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li><strong>Contact Details:</strong> Customer name, email address, and telephone/mobile number.</li>
          <li><strong>Delivery Address:</strong> Shipping address, city, state, postal code, and country for order delivery.</li>
          <li><strong>Order Details:</strong> Purchased products, selected quantities, sizes, and order reference identifiers.</li>
          <li><strong>Customer Communications:</strong> Messages sent to us via our contact form, wholesale enquiry form, email, or messaging apps.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Payment Information">
        <p>Payment transactions are processed through third-party payment service providers. Customers&apos; payment credentials (such as full card numbers or banking passwords) are handled by the applicable payment provider in accordance with its privacy and security policies. Buzzora does not directly store customers&apos; complete payment credentials on its own servers.</p>
        <p>If you receive an email or call from someone claiming to be Buzzora or Kannu Priya asking for passwords or card PINs, never provide them. Report suspicious communications immediately.</p>
      </PolicySection>

      <PolicySection title="How Information Is Used">
        <p>We use customer information strictly for legitimate operational and business purposes, including:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li>Processing, fulfilling, and delivering customer orders.</li>
          <li>Communicating order status updates, delivery information, and customer support responses.</li>
          <li>Processing authorized refunds or order cancellations.</li>
          <li>Maintaining website functionality and improving user experience.</li>
          <li>Preventing fraudulent, abusive, or unauthorized transactions.</li>
          <li>Complying with applicable accounting, tax, and legal obligations.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Information Sharing with Third-Party Service Providers">
        <p>Buzzora does not sell customer personal information. We share customer information only with necessary third-party service providers required to operate our business and fulfill your orders, such as:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-charcoal-mute">
          <li><strong>Logistics &amp; Courier Partners:</strong> For shipping and physical delivery of orders.</li>
          <li><strong>Payment Gateway Providers:</strong> For secure online payment processing.</li>
          <li><strong>Communication &amp; Hosting Services:</strong> For managing website infrastructure, email delivery, and customer enquiries.</li>
          <li><strong>Legal Requirements:</strong> When required by applicable law, regulation, or legal process to protect safety or rights.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Cookies and Technical Data">
        <p>The Platform uses essential browser storage (such as local storage) to maintain your shopping cart state while browsing. We do not use intrusive tracking mechanisms. Standard server logs (such as IP address and browser type) may be generated automatically for security and website maintenance.</p>
      </PolicySection>

      <PolicySection title="Data Security">
        <p>We implement reasonable security precautions and technical safeguards to protect customer information against unauthorized access, loss, disclosure, or alteration. However, no internet transmission or electronic storage method can be guaranteed to be completely secure, and users share information at their own risk.</p>
      </PolicySection>

      <PolicySection title="Data Retention">
        <p>We retain customer order records and contact information only for as long as reasonably necessary to fulfill order requirements, handle customer support enquiries, maintain accurate accounting records, and comply with legal or tax obligations.</p>
      </PolicySection>

      <PolicySection title="Customer Rights &amp; Contact Information">
        <p>Customers may write to us to update, correct, or request clarification regarding their order information or privacy questions.</p>
        <p className="mt-3 font-semibold text-charcoal">Grievance &amp; Business Contact Details:</p>
        <ul className="mt-2 space-y-1 text-sm text-charcoal-mute">
          <li><strong>Trade / Brand Name:</strong> Buzzora</li>
          <li><strong>Legal Proprietor:</strong> Kannu Priya (Sole Proprietorship)</li>
          <li><strong>Registered Business Address:</strong> Near Govt Middle School, Janglote Kathua Tehsil, Kathua, Kathua, Jammu &amp; Kashmir - 184104</li>
          <li><strong>Contact Email:</strong> <a href="mailto:buzzora.dev@gmail.com" className="underline text-honey-700">buzzora.dev@gmail.com</a></li>
          <li><strong>Phone / WhatsApp:</strong> <a href="https://wa.me/919186009531" target="_blank" rel="noopener noreferrer" className="underline text-honey-700">+91 9186009531</a></li>
          <li><strong>Support Hours:</strong> Monday – Friday (9:00 – 18:00 IST)</li>
        </ul>
      </PolicySection>
    </PolicyLayout>
  );
}
