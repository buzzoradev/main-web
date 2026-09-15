import { Numbered, PolicyLayout, PolicySection } from "../_components";

export const metadata = { title: "Refund & Cancellation Policy", description: "Buzzora refund and cancellation policy." };

export default function RefundCancellationPage() {
  return (
    <PolicyLayout title="Refund & Cancellation" intro="How to cancel an order or seek a refund for a product or service purchased through the Platform.">
      <PolicySection>
        <Numbered>
          <li>Cancellations will only be considered if the request is made 5 days of placing the order. Requests may not be entertained after the seller has started shipping or the product is out for delivery. You may choose to reject the product at the doorstep.</li>
          <li>9186009531 does not accept cancellation requests for perishable items like flowers and eatables. A refund or replacement may be made if the user establishes that the delivered product quality is not good.</li>
          <li>For damaged or defective items, report the issue to customer service. The request will be considered after the seller has checked and determined the issue. Report this within 5 days of receipt. If the product is not as shown or does not meet expectations, notify customer service within 5 days of receipt.</li>
          <li>For products carrying a manufacturer warranty, refer the issue to the manufacturer.</li>
          <li>For refunds approved by 9186009531, it will take 7 days for the refund to be processed.</li>
        </Numbered>
      </PolicySection>
    </PolicyLayout>
  );
}
