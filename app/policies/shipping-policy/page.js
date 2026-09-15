import { PolicyLayout, PolicySection } from "../_components";

export const metadata = { title: "Shipping Policy", description: "Buzzora shipping and delivery policy." };

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout title="Shipping Policy" intro="Shipping timelines, delivery, courier arrangements, and shipping charges.">
      <PolicySection>
        <p>Orders are shipped through registered domestic courier companies and/or speed post only. Orders are shipped within 5 days from the date of the order and/or payment, or according to the delivery date agreed at order confirmation, subject to courier and post office norms.</p>
        <p>The Platform Owner is not liable for delays by the courier company or postal authority. Orders are delivered to the address provided by the buyer at purchase. Delivery of services will be confirmed on the email ID provided at registration.</p>
        <p>Any shipping costs levied by the seller or Platform Owner, as applicable, are not refundable.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
