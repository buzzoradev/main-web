import { PolicyLayout, PolicySection } from "../_components";

export const metadata = { title: "Return Policy", description: "Buzzora return and exchange policy." };

export default function ReturnPolicyPage() {
  return (
    <PolicyLayout title="Return Policy" intro="Eligibility and processing for product returns and exchanges.">
      <PolicySection>
        <p>We offer refund or exchange within the first 7 days from the date of purchase. If 7 days have passed since your purchase, you will not be offered a return, exchange, or refund of any kind.</p>
        <p>To be eligible for a return or exchange, the purchased item should be unused and in the same condition as received, and must have its original packaging. Items purchased on sale may not be eligible for return or exchange. We replace items based on an exchange request only when they are found to be defective or damaged.</p>
        <p>Some categories of products or items may be exempt from returns or refunds; those categories will be identified at the time of purchase. For an accepted return or exchange, once the item is received and inspected, we will email you to confirm receipt. If approved after our quality check, the request will be processed in accordance with our policies.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
