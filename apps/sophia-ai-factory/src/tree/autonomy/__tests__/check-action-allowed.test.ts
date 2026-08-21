/**
 * Pure autonomy gate — no DB required.
 * Tests checkActionAllowed() for all 5 levels and representative action types.
 *
 * @module tree/autonomy/__tests__/check-action-allowed
 */

import { describe, it, expect } from 'vitest';
import { checkActionAllowed, type AutonomyLevel } from '../autonomy-repo';

function gate(level: AutonomyLevel, action: string): boolean {
  return checkActionAllowed(level, action);
}

describe('checkActionAllowed — pure gate', () => {
  it('level 0 (Manual): denies everything', () => {
    expect(gate(0, 'read_mission')).toBe(false);
    expect(gate(0, 'spend_credits')).toBe(false);
    expect(gate(0, 'delete_mission')).toBe(false);
  });

  it('level 1 (Suggest): denies everything', () => {
    expect(gate(1, 'read_mission')).toBe(false);
    expect(gate(1, 'get_status')).toBe(false);
    expect(gate(1, 'webhook_deregister')).toBe(false);
  });

  it('level 2 (Semi-auto): allows only read-only actions', () => {
    expect(gate(2, 'read_mission')).toBe(true);
    expect(gate(2, 'list_approvals')).toBe(true);
    expect(gate(2, 'get_status')).toBe(true);
    expect(gate(2, 'fetch_metrics')).toBe(true);
    expect(gate(2, 'read_logs')).toBe(true);
    expect(gate(2, 'spend_credits')).toBe(false);
    expect(gate(2, 'delete_mission')).toBe(false);
    expect(gate(2, 'update_billing')).toBe(false);
    expect(gate(2, 'webhook_deregister')).toBe(false);
  });

  it('level 3 (Auto): allows routine actions, blocks high-risk', () => {
    expect(gate(3, 'read_mission')).toBe(true);
    expect(gate(3, 'create_content')).toBe(true);
    expect(gate(3, 'publish')).toBe(true);
    expect(gate(3, 'spend_credits')).toBe(false);
    expect(gate(3, 'delete_mission')).toBe(false);
    expect(gate(3, 'update_billing')).toBe(false);
    expect(gate(3, 'revoke_credentials')).toBe(false);
    expect(gate(3, 'webhook_deregister')).toBe(false);
  });

  it('level 4 (Full): allows everything', () => {
    expect(gate(4, 'read_mission')).toBe(true);
    expect(gate(4, 'spend_credits')).toBe(true);
    expect(gate(4, 'delete_mission')).toBe(true);
    expect(gate(4, 'update_billing')).toBe(true);
    expect(gate(4, 'webhook_deregister')).toBe(true);
    expect(gate(4, 'revoke_credentials')).toBe(true);
  });

  it('unknown action at level 2 is denied', () => {
    expect(gate(2, 'unknown_action_xyz')).toBe(false);
  });

  it('unknown action at level 3 is allowed (not in blocked set)', () => {
    expect(gate(3, 'unknown_action_xyz')).toBe(true);
  });

  it('out-of-range level defaults to deny', () => {
    // Runtime edge case: a non-AutonomyLevel number reaches the default branch.
    expect(gate(99 as unknown as AutonomyLevel, 'read_mission')).toBe(false);
  });
});
