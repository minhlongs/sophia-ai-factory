/**
 * Action types and parameter interfaces for Playbook domain.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/types
 */

import type {
  PlaybookPattern,
  PlaybookRule,
  CampaignBlueprint,
  RecurringCampaignSchedule,
} from '@/seed/types/playbook-pattern';

export type ActionResult<T = unknown> =
  | { success: true; data: T; error?: string; code?: string }
  | { success: false; error: string; code?: string; data?: Partial<T> };

export interface PlaybookOverviewData {
  patterns: PlaybookPattern[];
  rules: PlaybookRule[];
  blueprints: CampaignBlueprint[];
  schedules: RecurringCampaignSchedule[];
}

export interface SaveScheduleParams {
  workspaceId: string;
  blueprintId: string;
  scheduleCron: string;
  batchSize: number;
  isActive: boolean;
  scheduleId?: string;
}

export interface TriggerBatchParams {
  workspaceId: string;
  blueprintId: string;
  batchSize: number;
}
