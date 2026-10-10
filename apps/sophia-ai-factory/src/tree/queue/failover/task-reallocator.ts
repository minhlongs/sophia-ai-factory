/**
 * Failover errors and task allocation failure tracking.
 *
 * @module tree/queue/failover/task-reallocator
 */

import type { ProviderAttemptRecord } from './types';

/**
 * Error thrown when all providers in the mesh chain fail or are unavailable
 */
export class AllProvidersFailedError extends Error {
  public readonly attempts: ProviderAttemptRecord[];
  public readonly jobId: string;

  constructor(jobId: string, attempts: ProviderAttemptRecord[]) {
    const summary = attempts
      .map((a) => `${a.provider}: ${a.status}${a.error ? ` (${a.error})` : ''}`)
      .join('; ');
    super(`All GPU providers in mesh failed for job ${jobId}. Summary: [${summary}]`);
    this.name = 'AllProvidersFailedError';
    this.jobId = jobId;
    this.attempts = attempts;
  }
}
