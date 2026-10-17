/**
 * Harness Daemon Health Checks Runner.
 *
 * Executes the 6 health checks for a harness job (D1, R2, OpenRouter,
 * ElevenLabs, HeyGen, Remotion local render).
 *
 * @module tree/harness/daemon-checks
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

import { validateOpenRouter, validateElevenLabs, validateHeyGen } from '@/seed/validation/services';

const execAsync = promisify(exec);

export interface HarnessCheckResult {
  test_name: string;
  status: string;
  duration_ms: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

export async function runCheck(
  name: string,
  checkFn: () => Promise<{ success: boolean; error_message?: string | null; metadata?: Record<string, unknown> }>,
): Promise<HarnessCheckResult> {
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

export async function runAllHarnessChecks(
  targetHost: string,
  harnessSecret: string,
  getEnv: (key: string) => string | undefined,
): Promise<HarnessCheckResult[]> {
  const results: HarnessCheckResult[] = [];

  results.push(await runCheck('d1_ping', async () => {
    const res = await fetch(`${targetHost}/api/health`);
    if (!res.ok) throw new Error(`Health check returned status ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return { success: true, metadata: { data } };
  }));

  results.push(await runCheck('r2_storage', async () => {
    const res = await fetch(`${targetHost}/api/v1/harness/check/r2`, {
      headers: { 'x-harness-secret': harnessSecret },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`R2 check failed: ${errText || res.statusText}`);
    }
    const data = await res.json() as Record<string, unknown>;
    return { success: !!data.success, error_message: (data.error as string) || null };
  }));

  results.push(await runCheck('api_openrouter', async () => {
    const res = await validateOpenRouter(getEnv('OPENROUTER_API_KEY') || '');
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  results.push(await runCheck('api_elevenlabs', async () => {
    const res = await validateElevenLabs(getEnv('ELEVENLABS_API_KEY') || '');
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

  results.push(await runCheck('api_heygen', async () => {
    const res = await validateHeyGen(getEnv('HEYGEN_API_KEY') || '');
    return { success: res.valid, error_message: res.message, metadata: res.meta ? { meta: res.meta } : undefined };
  }));

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
        stderr: stderr.trim().substring(0, 1000),
      },
    };
  }));

  return results;
}
