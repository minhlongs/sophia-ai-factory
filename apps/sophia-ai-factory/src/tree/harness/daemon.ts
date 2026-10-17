/**
 * Harness Daemon — system health check runner.
 *
 * NOTE: This is a LOCAL-ONLY tool. It uses Node.js APIs (child_process, fs)
 * that are NOT available on Cloudflare Workers. Run it on your dev machine
 * or a dedicated server via `npx tsx src/tree/harness/daemon.ts`.
 *
 * The daemon polls for pending harness jobs, runs 6 health checks,
 * and reports results back via the harness API endpoints.
 */

import { logger } from '@/seed/utils/logger-utility';
import { runAllHarnessChecks } from './daemon-checks';

export { runCheck, runAllHarnessChecks, type HarnessCheckResult } from './daemon-checks';

// Get cloudflare env with fallback for local dev
function getEnv(key: string): string | undefined {
  return process.env[key];
}

const HARNESS_SECRET = getEnv('HARNESS_SECRET') || getEnv('CRON_SECRET') || 'dev-harness-secret';
const TARGET_HOST = getEnv('HARNESS_TARGET_HOST') || 'http://localhost:3000';
const POLL_INTERVAL_MS = 10_000;

logger.info(`[Harness Daemon] Started. Polling target: ${TARGET_HOST}. Interval: ${POLL_INTERVAL_MS}ms`);

async function processJob(jobId: string) {
  logger.info(`[Harness Daemon] Processing job ${jobId}...`);

  const results = await runAllHarnessChecks(TARGET_HOST, HARNESS_SECRET, getEnv);
  const jobStatus = results.every(r => r.status === 'success') ? 'completed' : 'failed';

  try {
    const patchRes = await fetch(`${TARGET_HOST}/api/v1/harness/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-harness-secret': HARNESS_SECRET,
      },
      body: JSON.stringify({ status: jobStatus, results }),
    });

    if (!patchRes.ok) {
      throw new Error(`Failed to update job status: ${patchRes.statusText}`);
    }

    logger.info(`[Harness Daemon] Job ${jobId} successfully marked as ${jobStatus}.`);
  } catch (err) {
    logger.error(`[Harness Daemon] Error reporting job ${jobId} status:`, err instanceof Error ? err : new Error(String(err)));
  }
}

async function pollQueue() {
  try {
    const res = await fetch(`${TARGET_HOST}/api/v1/harness/jobs/poll`, {
      headers: { 'x-harness-secret': HARNESS_SECRET },
    });

    if (!res.ok) {
      logger.error(`[Harness Daemon] Polling error: ${res.statusText}`);
      return;
    }

    const data = await res.json() as { success: boolean; job: { id: string } | null };
    if (data.success && data.job) {
      await processJob(data.job.id);
    }
  } catch (err) {
    logger.error('[Harness Daemon] Network error during polling:', err instanceof Error ? err : new Error(String(err)));
  }
}

// Start execution polling loop
setInterval(pollQueue, POLL_INTERVAL_MS);
pollQueue();
