/**
 * Valid state transitions for referral events.
 *
 * Allowed edges:
 *   created  → clicked
 *   clicked  → converted
 *   created  → converted          (direct attribution without a separate click record)
 *   converted → rewarded          (reward fulfillment after payment confirmed)
 *
 * Invalid transitions return false so callers can decide recovery behavior.
 *
 * @module referral/referral-events
 */

export type ReferralEventType = 'created' | 'clicked' | 'converted' | 'rewarded';

const ALLOWED: Record<ReferralEventType, Set<ReferralEventType>> = {
  created: new Set<ReferralEventType>(['clicked', 'converted']),
  clicked: new Set<ReferralEventType>(['converted']),
  converted: new Set<ReferralEventType>(['rewarded']),
  rewarded: new Set<ReferralEventType>(),
};

/**
 * Returns true if advancing from -> to is a valid transition.
 * Terminal states (rewarded) have no outgoing edges.
 */
export function canTransition(from: ReferralEventType, to: ReferralEventType): boolean {
  return ALLOWED[from]?.has(to) ?? false;
}
