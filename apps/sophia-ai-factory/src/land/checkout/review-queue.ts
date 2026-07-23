import type { QueuedCheckoutItem } from './types';
export type CheckoutReviewAction = 'approve'|'reject'|'cancel';
export function filterEligible(items: QueuedCheckoutItem[]){
  return items.filter(i=>['review_required','pending'].includes(i.status));
}
