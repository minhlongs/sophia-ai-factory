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

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

import { validateOpenRouter, validateElevenLabs, validateHeyGen } from '@/seed/validation/services';
import { logger } from '@/seed/utils/logger-utility';

const execAsync = promisify(exec);

// Get cloudflare env with fallback for local dev
function getEnv(key: string): string | undefined {
  return process.env[key];
}

const HARNESS_SECRET = getEnv('HARNESS_SECRET') || getEnv('CRON_SECRET') || 'dev-harness-secret';
const TARGET_HOST = getEnv('HARNESS_TARGET_HOST') || 'http://localhost:3000';
const POLL_INTERVAL_MS = 10_000;

logger.info(`[Harness Daemon] Started. Polling target: ${TARGET_HOST}. Interval: ${POLL_INTERVAL_MS}ms`);

async function runCheck(name: string, checkFn: () => Promise<{ success: boolean; error_message?: string | null; metadata?: Record<string, unknown> }>) {
  const start = Date.now();
  try {
    const result = await checkFn();
    const duration = Date.now() - start;
    return {
      test_name: name,
      status: result.success ? 'success' : 'failed',
      duration_ms: duration,
      error_message: result.error_message || null,
      metadata: result.metadata || null,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      test_name: name,
      status: 'failed',
      duration_ms: duration,
      error_message: err instanceof Error ? err.message : String(err),
      metadata: null,
    };
  }
}

async function processJob(jobId: string) {
  logger.info(`[Harness Daemon] Processing job ${jobId}...`);

  const results = [];

  // Check 1: D1 Ping
  results.push(await runCheck('d1_ping', async () => {
    const res = await fetch(`${TARGET_HOST}/api/health`);
    if (!res.ok) {
      throw new Error(`Health check returned status ${res.status}`);
    }
    const data = await res.json() as Record<string, unknown>;
    return { success: true, metadata: { data } };
  }));

  // Check 2: R2 Storage Write
  results.push(await runCheck('r2_storage', async () => {
    const res = await fetch(`${TARGET_HOST}/api/v1/harness/check/r2`, {
      headers: { 'x-harness-secret': HARNESS_SECRET }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`R2 check failed: ${errText || res.statusText}`);
    }
    const data = await res.json() as Record<string, unknown>;
    return { success: !!data.success, error_message: data.error as string || null };
  }));

  // Check 3: API OpenRouter validation
  results.push(await runCheck('api_openrouter', async () => {
    const key = getEnv('OPENROUTER_API_KEY') || '';
    const res = await validateOpenRouter(key);
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  // Check 4: API ElevenLabs validation
  results.push(await runCheck('api_elevenlabs', async () => {
    const key = getEnv('ELEVENLABS_API_KEY') || '';
    const res = await validateElevenLabs(key);
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  // Check 5: API HeyGen validation
  results.push(await runCheck('api_heygen', async () => {
    const key = getEnv('HEYGEN_API_KEY') || '';
    const res = await validateHeyGen(key);
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  // Check 6: Remotion Video Render Check (local-only)
  results.push(await runCheck('remotion_render', async () => {
    const templatePath = path.resolve(__dirname, '../../../template/test-composite.js');
    const outDir = path.resolve(__dirname, '../../../out');
    const outPath = path.resolve(outDir, 'test-out.mp4');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const command = `npx remotion render "${templatePath}" "${outPath}" --overwrite`;
    const { stdout, stderr } = await execAsync(command);

    if (!fs.existsSync(outPath)) {
      throw new Error('Remotion render completed but output file test-out.mp4 was not generated.');
    }

    return {
      success: true,
      metadata: {
        stdout: stdout.trim().substring(0, 1000),
        stderr: stderr.trim().substring(0, 1000)
      }
    };
  }));

  const jobStatus = results.every(r => r.status === 'success') ? 'completed' : 'failed';

  try {
    const patchRes = await fetch(`${TARGET_HOST}/api/v1/harness/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-harness-secret': HARNESS_SECRET
      },
      body: JSON.stringify({ status: jobStatus, results })
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
      headers: { 'x-harness-secret': HARNESS_SECRET }
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
