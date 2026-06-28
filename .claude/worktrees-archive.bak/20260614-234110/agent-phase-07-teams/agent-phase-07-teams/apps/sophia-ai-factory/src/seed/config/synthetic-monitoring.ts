/**
 * Synthetic monitoring constants — shared between smoke-one-time cron and
 * one-time-fulfillment library so both code paths recognize the synthetic user.
 *
 * The smoke-one-time cron inserts a fake purchase every 15 minutes and then
 * triggers fulfillment. To validate the chain end-to-end WITHOUT actually
 * calling HeyGen (which would require an operator-side API key, violating the
 * no-tech doctrine), the fulfillment library short-circuits when it sees the
 * synthetic user id and marks the video row as `'completed'` directly.
 *
 * If the user id ever needs to change, update both:
 *   - `src/app/api/cron/smoke-one-time/route.ts`
 *   - any tests asserting on this constant
 */

/** UUID reserved for synthetic monitoring purchases. */
export const SYNTHETIC_USER_ID = '00000000-0000-0000-0000-000000000001';

/** Quick predicate — true for synthetic monitoring user. */
export function isSyntheticMonitoringUser(userId: string): boolean {
  return userId === SYNTHETIC_USER_ID;
}
