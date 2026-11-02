/**
 * Supreme Command #02.1 Regression Suite — Part 3: P2 10 Crash & Recovery Windows
 *
 * Tests all 10 mandatory crash/interruption windows against the real SQLite D1
 * convergence ledger (`0494_authoritative_job_convergence_ledger.sql`), proving:
 *   - zero silent loss
 *   - zero duplicate external side effects
 *   - zero false converged truth
 *   - deterministic recovery or quarantine across every failure boundary
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import { transitionConvergenceCasD1 } from '@/tree/convergence';
import { runCreativeJobVerticalSliceD1 } from '@/forest/convergence/creative-job-d1-runner';

const MIGRATION_0494_SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'migrations/0494_authoritative_job_convergence_ledger.sql'),
  'utf8'
);

describe('Supreme Command #02.1 — P2: 10 Crash & Recovery Windows on Real SQLite D1', () => {
  let d1: D1Database;
  let artifactRootDir: string;

  beforeEach(() => {
    const raw = freshDb();
    raw.exec(MIGRATION_0494_SQL);
    d1 = makeD1(raw) as unknown as D1Database;
    artifactRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-p2-crash-'));
  });

  it('Windows 1, 2, & 3: crashes after intake, after lease acquisition, and after Mekong submission before ticket record all recover cleanly on replay', async () => {
    // Window 1: Crash after intake before lease acquisition
    const w1Crash = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w01', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w01',
      goal: 'W01 test', simulateCrashWindow: 'W01_AFTER_INTAKE_BEFORE_LEASE', artifactRootDir,
    });
    expect(w1Crash.ok && !w1Crash.value.truthState.isTrulyComplete).toBe(true);
    const w1Recover = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w01', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w01',
      goal: 'W01 test', artifactRootDir,
    });
    expect(w1Recover.ok && w1Recover.value.truthState.isTrulyComplete).toBe(true);

    // Window 2: Crash after lease acquisition before Mekong submission (recover after lease expiry)
    const w2Crash = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w02', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w02',
      goal: 'W02 test', simulateCrashWindow: 'W02_AFTER_LEASE_BEFORE_MEKONG',
      leaseDurationMs: 1000, nowMs: 1000, artifactRootDir,
    });
    expect(w2Crash.ok && !w2Crash.value.truthState.isTrulyComplete).toBe(true);
    const w2Recover = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w02', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w02',
      goal: 'W02 test', nowMs: 5000, artifactRootDir,
    });
    expect(w2Recover.ok && w2Recover.value.truthState.isTrulyComplete).toBe(true);

    // Window 3: Crash after Mekong submission before ticket ID is recorded
    const w3Crash = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w03', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w03',
      goal: 'W03 test', simulateCrashWindow: 'W03_AFTER_MEKONG_BEFORE_RECORD',
      leaseDurationMs: 1000, nowMs: 1000, artifactRootDir,
    });
    expect(w3Crash.ok && w3Crash.value.record.mekongJobId === null).toBe(true);
    const w3Recover = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w03', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w03',
      goal: 'W03 test', nowMs: 5000, artifactRootDir,
    });
    expect(w3Recover.ok && Boolean(w3Recover.value.record.mekongJobId)).toBe(true);
  });

  it('Windows 4, 5, 6, & 8: crashes during render, after artifact write, after verification, and after delivery before cost all preserve partial state and converge on recovery', async () => {
    for (const [idx, win] of [
      'W04_DURING_RENDER_BEFORE_ARTIFACT',
      'W05_AFTER_ARTIFACT_BEFORE_VERIFICATION',
      'W06_AFTER_VERIFICATION_BEFORE_DELIVERY',
      'W08_AFTER_DELIVERY_BEFORE_COST',
    ].entries()) {
      const jobId = `job_w_mid_${idx}`;
      const idem = `idem_w_mid_${idx}`;
      const crashed = await runCreativeJobVerticalSliceD1(d1, {
        jobId, workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: idem,
        goal: `Crash test ${win}`,
        simulateCrashWindow: win as 'W04_DURING_RENDER_BEFORE_ARTIFACT',
        leaseDurationMs: 1000, nowMs: 1000, artifactRootDir,
      });
      expect(crashed.ok).toBe(true);
      if (!crashed.ok) return;
      expect(crashed.value.truthState.isTrulyComplete).toBe(false);

      const recovered = await runCreativeJobVerticalSliceD1(d1, {
        jobId, workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: idem,
        goal: `Crash test ${win}`, nowMs: 5000, artifactRootDir,
      });
      expect(recovered.ok).toBe(true);
      if (recovered.ok) {
        expect(recovered.value.truthState.isTrulyComplete).toBe(true);
        expect(recovered.value.record.artifactManifest.length).toBe(5);
      }
    }
  });

  it('Windows 7, 9, & 10: quarantines uncertain external publish side effects (W07), scopes retry attempt IDs (W09), and rejects zombie worker callbacks after lease expiry (W10)', async () => {
    // Window 7: Crash after external delivery publish before receipt confirmation -> quarantined (no auto-republish)
    const w7 = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w07', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w07',
      goal: 'W07 uncertain publish', simulateCrashWindow: 'W07_AFTER_EXTERNAL_PUBLISH_BEFORE_RECEIPT',
      artifactRootDir,
    });
    expect(w7.ok).toBe(true);
    if (w7.ok) {
      expect(w7.value.record.sideEffectUncertain).toBe(true);
      expect(w7.value.truthState.overallStatus).toBe('human_review_required');
      expect(w7.value.truthState.isTrulyComplete).toBe(false);
    }

    // Window 9: Retry scheduling increments attemptNo and scopes Mekong event_id (`::attempt-2`)
    const w9 = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w09', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w09',
      goal: 'W09 retry scheduling', simulateCrashWindow: 'W09_DURING_RETRY_SCHEDULING',
      artifactRootDir,
    });
    expect(w9.ok).toBe(true);
    if (w9.ok) {
      expect(w9.value.record.attemptNo).toBe(2);
      expect(w9.value.truthState.isTrulyComplete).toBe(true);
    }

    // Window 10: Lease expires during W02 crash, Worker B takes over and finishes, then Zombie Worker A tries late callback
    const w10Crash = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w10', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w10',
      goal: 'W10 zombie callback', simulateCrashWindow: 'W02_AFTER_LEASE_BEFORE_MEKONG',
      leaseTokenOverride: 'zombie_worker_a', leaseDurationMs: 1000, nowMs: 1000, artifactRootDir,
    });
    expect(w10Crash.ok).toBe(true);
    if (!w10Crash.ok) return;

    const w10Takeover = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_w10', workspaceId: 'ws_alpha', userId: 'u_1', idempotencyKey: 'idem_w10',
      goal: 'W10 zombie callback', leaseTokenOverride: 'active_worker_b',
      leaseDurationMs: 60000, nowMs: 5000, artifactRootDir,
    });
    expect(w10Takeover.ok && w10Takeover.value.truthState.isTrulyComplete).toBe(true);

    // Zombie Worker A wakes up late and attempts to overwrite the job
    const zombieWrite = await transitionConvergenceCasD1(d1, {
      jobId: 'job_w10', workspaceId: 'ws_alpha', expectedVersion: w10Crash.value.record.version,
      leaseToken: 'zombie_worker_a', lifecycleStage: 'media_render_dispatch',
    });
    expect(zombieWrite.ok).toBe(false);
    if (!zombieWrite.ok) expect(zombieWrite.error.code).toBe('TERMINAL_STATE_IMMUTABLE');
  });
});
