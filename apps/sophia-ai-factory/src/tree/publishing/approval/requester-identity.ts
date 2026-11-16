/**
 * Requester identity for the publish approval ledger.
 * Layer: TREE (domain-specific reusable)
 *
 * The ledger's `requester_id` column answers one question a reviewer asks of a
 * pending publish: "did I ask for this?" Only a signed-in user's id can answer
 * it. A scheduled lane has no signed-in user, so it arrives carrying either the
 * workspace it acts for or a sentinel, and recording either names the wrong
 * party: a workspace id collides with the sole admin's id and invents a
 * self-approval, while the sentinel makes every cron publish look like someone
 * else's work.
 *
 * The rule is applied where the value is written rather than at each caller, so
 * a lane that passes its own identifier through cannot reintroduce the
 * conflation.
 *
 * @module tree/publishing/approval/requester-identity
 */

/** The placeholder a lane with no signed-in user sends in the user slot. */
export const SYSTEM_REQUESTER_SENTINEL = 'system';

/**
 * Returns the value when it names a real user, otherwise `undefined` so the
 * ledger records no requester rather than a stand-in.
 */
export function toRequesterId(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === SYSTEM_REQUESTER_SENTINEL) return undefined;
  return trimmed;
}
