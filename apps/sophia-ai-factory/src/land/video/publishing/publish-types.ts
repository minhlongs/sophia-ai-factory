/**
 * Types for the publish execution workflow.
 * @module land/video/publishing/publish-types
 */

import type { PublishingChannel, PublishingJob } from '@/seed/types';

export interface Step {
  sleep(name: string, duration: string): Promise<void>;
  run<T>(name: string, fn: () => Promise<T>): Promise<unknown>;
}

export interface ExecutePublishWorkflowArgs {
  jobId: string;
  tenantId: string;
  userId: string;
  step: Step;
  eventId?: string;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number) => Promise<void>;
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
