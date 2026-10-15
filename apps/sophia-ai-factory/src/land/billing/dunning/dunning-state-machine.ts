/**
 * Dunning State Machine
 *
 * Manages state reads, transitions, and access decisions for the dunning lifecycle.
 * Pure transition logic lives in dunning-transition-logic.ts.
 *
 * @module billing/dunning/dunning-state-machine
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getDunningSettings } from './dunning-state-queries';

// Re-export types for backward compatibility
export type { DunningState, DunningTierConfig } from './dunning-transition-logic';
export { DUNNING_TIER_CONFIGS, calculateNextRetry, determineNewState } from './dunning-transition-logic';
export {
  getDunningSettings,
  getDunningState,
  type DunningEventType,
  type DunningSettingsRow,
  type DunningStateResult,
} from './dunning-state-queries';

// -------------------------------------------------------------------------
// State transitions
// -------------------------------------------------------------------------

/**
 * Transition dunning state in the database.
 *
 * FIX-9B: optimistic locking — includes old state in WHERE clause to prevent
 * TOCTOU races. If 0 rows affected (concurrent state change detected), retries
 * once after re-reading current state.
 */
export async function transitionDunningState(
  licenseNonce: string,
  userId: string,
  newState: import('./dunning-transition-logic').DunningState
): Promise<void> {
  const currentSettings = await getDunningSettings(licenseNonce);
  const oldState = currentSettings?.dunning_state || 'current';

  if (oldState === newState) {
    logger.debug('[Dunning] State unchanged, skipping', { licenseNonce: licenseNonce.slice(0, 8), state: newState });
    return;
  }

  const db = createServerClient();

  // FIX-9B: optimistic lock — WHERE includes current state so concurrent
  // transitions cannot silently overwrite each other.
  const result = await db.unwrap().prepare(
    `UPDATE dunning_settings
     SET dunning_state = ?1, dunning_state_changed_at = datetime('now'), updated_at = datetime('now')
     WHERE license_nonce = ?2 AND dunning_state = ?3`,
  ).bind(newState, licenseNonce, oldState).run();

  if ((result.meta as { changes?: number })?.changes === 0) {
    // Possible TOCTOU race — re-read current state and retry once
    const retrySettings = await getDunningSettings(licenseNonce);
    const retryState = retrySettings?.dunning_state || 'current';
    if (retryState === newState) {
      logger.debug('[Dunning] Already at target state (retry)', { licenseNonce: licenseNonce.slice(0, 8), state: newState });
      return;
    }
    if (retryState !== oldState && retryState !== newState) {
      // Different concurrent transition — log and accept current state
      logger.warn('[Dunning] Concurrent transition detected, accepting new state', {
        licenseNonce: licenseNonce.slice(0, 8),
        from: oldState,
        concurrent: retryState,
        requested: newState,
      });
      return;
    }
    // Retry with the fresh state as the WHERE anchor
    await db.unwrap().prepare(
      `UPDATE dunning_settings
       SET dunning_state = ?1, dunning_state_changed_at = datetime('now'), updated_at = datetime('now')
       WHERE license_nonce = ?2 AND dunning_state = ?3`,
    ).bind(newState, licenseNonce, retryState).run();
  }

  logger.info('[Dunning] State transitioned', {
    licenseNonce: licenseNonce.slice(0, 8),
    from: oldState,
    to: newState,
  });
}
