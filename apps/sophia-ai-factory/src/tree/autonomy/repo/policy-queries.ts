/**
 * Autonomy Repository Policy Queries
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/autonomy/repo/policy-queries
 */

import { type AutonomyLevel } from './types';

/**
 * Pure autonomy gate: maps an autonomy level to whether an action is
 * permitted, without touching the database.
 *
 * Rules:
 * - 0 (Manual): always false
 * - 1 (Suggest): always false (agent only proposes)
 * - 2 (Semi-auto): allow low-risk actions (informational, read-only)
 * - 3 (Auto): allow all routine actions; block high-risk (spend, delete)
 * - 4 (Full): always true
 */
export function checkActionAllowed(level: AutonomyLevel, actionType: string): boolean {
  switch (level) {
    case 0:
      return false;
    case 1:
      return false;
    case 2: {
      const readOnlyActions = new Set([
        'read_mission',
        'list_approvals',
        'get_status',
        'fetch_metrics',
        'read_logs',
      ]);
      return readOnlyActions.has(actionType);
    }
    case 3: {
      const blockedActions = new Set([
        'spend_credits',
        'delete_mission',
        'update_billing',
        'revoke_credentials',
        'webhook_deregister',
      ]);
      return !blockedActions.has(actionType);
    }
    case 4:
      return true;
    default:
      return false;
  }
}
