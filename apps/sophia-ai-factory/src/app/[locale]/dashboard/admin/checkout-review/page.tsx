import { Metadata } from 'next';
import { CheckoutReviewClient } from './checkout-review-client';

export const metadata: Metadata = {
  title: 'Checkout Review Queue | Sophia AI',
  description: 'Review pending checkout orders for manual approval or rejection.',
};

export default function CheckoutReviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Checkout Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review and resolve orders that require manual verification.
        </p>
      </div>
      <CheckoutReviewClient />
    </div>
  );
}
