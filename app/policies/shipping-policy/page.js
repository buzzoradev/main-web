import { PolicyLayout, PolicySection } from "../_components";

export const metadata = { title: "Shipping Policy", description: "Buzzora shipping and delivery policy." };

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout title="Shipping Policy" intro="Shipping timelines, delivery, courier arrangements, and shipping charges for Buzzora, operated by Kannu (Sole Proprietorship).">
      <PolicySection>
        <p>Orders placed through Buzzora are shipped through registered domestic courier companies and/or speed post only. Orders are shipped within 5 days from the date of the order and/or payment, or according to the delivery date agreed at order confirmation, subject to courier and post office norms.</p>
        <p>The Platform Owner (Kannu, operating as Buzzora) is not liable for delays caused by courier companies or postal authorities. Orders are delivered to the shipping address provided by the buyer at purchase. Delivery confirmation will be sent to the email ID provided at order placement.</p>
        <p>Any shipping costs levied by Buzzora, as applicable, are non-refundable.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
