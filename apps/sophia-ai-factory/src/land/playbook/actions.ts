/**
 * Server Actions for Auto-Creative Playbook & Campaign Intelligence — Phase 5 Facade
 *
 * Provides typed, fail-closed actions for the Playbook dashboard:
 * - getPlaybookOverviewAction: Fetches winning patterns, derived rules, blueprints, and recurring schedules.
 * - toggleRuleAutoApplyAction: Atomically toggles rule auto-apply via OCC CAS (`WHERE id = ? AND updated_at = ?`).
 * - rollbackRuleAction: Safely disables auto-apply, increments `rollback_count`, and updates timestamp.
 * - saveRecurringScheduleAction: Persists recurring batch schedules to `recurring_campaign_runs` and `scheduled_campaigns`.
 * - toggleRecurringScheduleAction: Toggles active status on recurring schedules.
 * - triggerBatchRunAction: Runs 7-gate preflight, checks monthly tier quota, deducts MCU credits, and dispatches batch missions.
 *
 * Layer: land (business workflows / Server Actions)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree. Zero imports from @/forest!
 *
 * @module land/playbook/actions
 */

'use server';

export * from './actions/types';
export * from './actions/overview-actions';
export * from './actions/rule-actions';
export * from './actions/schedule-actions';
export * from './actions/batch-run-actions';
