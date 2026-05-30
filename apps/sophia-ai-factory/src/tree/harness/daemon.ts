import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { validateOpenRouter, validateElevenLabs, validateHeyGen } from '../../lib/validation/services';

const execAsync = promisify(exec);

// Load secrets from local config / environment variables
const HARNESS_SECRET = process.env.HARNESS_SECRET || process.env.CRON_SECRET || 'dev-harness-secret';
const TARGET_HOST = process.env.HARNESS_TARGET_HOST || 'http://localhost:3000';
const POLL_INTERVAL_MS = 10_000;

console.log(`[Harness Daemon] Started. Polling target: ${TARGET_HOST}. Interval: ${POLL_INTERVAL_MS}ms`);

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
  console.log(`[Harness Daemon] Processing job ${jobId}...`);

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
    const key = process.env.OPENROUTER_API_KEY || '';
    const res = await validateOpenRouter(key);
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  // Check 4: API ElevenLabs validation
  results.push(await runCheck('api_elevenlabs', async () => {
    const key = process.env.ELEVENLABS_API_KEY || '';
    const res = await validateElevenLabs(key);
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  // Check 5: API HeyGen validation
  results.push(await runCheck('api_heygen', async () => {
    const key = process.env.HEYGEN_API_KEY || '';
    const res = await validateHeyGen(key);
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  // Check 6: Remotion Video Render Check
  results.push(await runCheck('remotion_render', async () => {
    // Locate the test template
    const templatePath = path.resolve(__dirname, '../../../template/test-composite.js');
    const outDir = path.resolve(__dirname, '../../../out');
    const outPath = path.resolve(outDir, 'test-out.mp4');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Run remotion compilation
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

  // Aggregate final job status
  const jobStatus = results.every(r => r.status === 'success') ? 'completed' : 'failed';

  // Send PATCH request back to the Edge gateway
  try {
    const patchRes = await fetch(`${TARGET_HOST}/api/v1/harness/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-harness-secret': HARNESS_SECRET
      },
      body: JSON.stringify({
        status: jobStatus,
        results
      })
    });

    if (!patchRes.ok) {
      throw new Error(`Failed to update job status: ${patchRes.statusText}`);
    }

    console.log(`[Harness Daemon] Job ${jobId} successfully marked as ${jobStatus}.`);
  } catch (err) {
    console.error(`[Harness Daemon] Error reporting job ${jobId} status:`, err);
  }
}

async function pollQueue() {
  try {
    const res = await fetch(`${TARGET_HOST}/api/v1/harness/jobs/poll`, {
      headers: { 'x-harness-secret': HARNESS_SECRET }
    });

    if (!res.ok) {
      console.error(`[Harness Daemon] Polling error: ${res.statusText}`);
      return;
    }

    const data = await res.json() as { success: boolean; job: { id: string } | null };
    if (data.success && data.job) {
      await processJob(data.job.id);
    }
  } catch (err) {
    console.error('[Harness Daemon] Network error during polling:', err);
  }
}

// Start execution polling loop
setInterval(pollQueue, POLL_INTERVAL_MS);
// Run initial poll instantly
pollQueue();
