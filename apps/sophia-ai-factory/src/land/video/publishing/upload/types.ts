import { createServerClient } from '@/seed/db/client';
import type { PublishingChannel, PublishingJob } from '@/seed/types';
import type { Step } from '../publish-types';

export interface UploadToProviderArgs {
  channel: PublishingChannel;
  accessToken: string;
  videoUrl: string;
  job: PublishingJob;
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  retryCount: number;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number, delayMs?: number) => Promise<void>;
  tenantId: string;
  userId: string;
}

export interface PollStatusArgs {
  step: Step;
  tenantId: string;
  provider: string;
  externalPostId: string;
}
