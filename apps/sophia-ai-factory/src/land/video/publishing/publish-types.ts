/**
 * Types for the publish execution workflow.
 * @module land/video/publishing/publish-types
 */

import type { PublishingChannel, PublishingJob } from '@/seed/types';
import type { PublishApprovalStep } from '@/tree/publishing/approval';

export interface Step {
  sleep(name: string, duration: string): Promise<void>;
  run<T>(name: string, fn: () => Promise<T>): Promise<unknown>;
}

/**
 * The tools a step runtime needs when a publish must suspend for a human
 * decision. Declared apart from `Step` because the payload belongs to the
 * caller's Inngest client: its event map is far wider than one publish flow,
 * and pinning that union here would force a cast at every runtime that emits or
 * waits. `PublishApprovalStep` is already the narrow, runtime-agnostic shape
 * the approval gate is written against.
 */
export type StepEventTools = PublishApprovalStep;

export interface ExecutePublishWorkflowArgs {
  jobId: string;
  tenantId: string;
  userId: string;
  step: Step;
  eventId?: string;
  alreadyClaimed?: boolean;
  /** Required when a public publish must wait for a human decision. */
  eventTools?: StepEventTools;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number, delayMs?: number) => Promise<void>;
  refreshToken?: (channel: PublishingChannel) => Promise<number>;
}

export type ClaimResult =
  | { skipped: true; jobId: string; status: string; externalPostId: ''; provider: '' }
  | { skipped: false; jobId: string; status: 'processing'; externalPostId: string; provider: string }
  | { skipped: false; jobId: string; status: 'live'; externalPostId: string; provider: string }
  | {
      skipped: false;
      jobId: string;
      status: 'telegram-claimed';
      provider: 'telegram';
      externalPostId: '';
      telegramPayload: { videoUrl: string; chatId: string; caption: string };
    }
  | { skipped: false; jobId: string; status: 'failed' | 'scheduled'; externalPostId: ''; provider: ''; error?: string };

export type { PublishingJob };
