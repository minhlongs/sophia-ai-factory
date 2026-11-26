// @vitest-environment node
/**
 * Commercial Pilot Quota Enforcement, Concurrent Reservation, & Status-Check Zero-Quota Suite.
 *
 * Verifies restored commercial limits (PILOT_MAX_GENERATIONS=20, PILOT_MAX_ESTIMATED_SPEND_USD=4.00):
 * 1. Existing customer usage (1 gen / $0.02) stays safely under cap without resetting counters.
 * 2. Customer at/above 20 generations or $4.00 spend is blocked on new generations with a clear error,
 *    while still retaining read access to existing assets and `poll_heygen_mp4` status checks (0 quota cost).
 * 3. Concurrent reservation safety prevents double-booking via atomic in-flight lock.
 * 4. Customer-funded BYOK only (no silent platform fallback) and zero automatic paid retries.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import { PILOT_POLICY_VERSION, type PilotEnvSource } from '@/seed/pilot/pilot-access-policy';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, verifyCsrfToken } from '@/seed/security/csrf';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '@/land/first-value/first-value-http-handler';
import { recordPilotMp4Export } from '@/tree/first-value/pilot-commercial-repo';
import {
  getPilotQuotaStatus,
  recordPilotConsent,
  reservePilotGenerationSlot,
} from '@/tree/first-value/pilot-state-repo';

const CSRF_TOKEN = 'csrf-token-commercial-quota-0123456789abcdef';
const SIGNING_SECRET = 'pilot-quota-test-signing-secret-32-bytes';

const MIGRATIONS = [
  '../../../../migrations/0515_first_value_reviews.sql',
  '../../../../migrations/0517_customer_pilot_first_value.sql',
  '../../../../migrations/0519_pilot_support_requests.sql',
  '../../../../migrations/0520_pilot_affiliate_revenue_studio.sql',
  '../../../../migrations/0521_pilot_commercial_validation.sql',
].map((rel) => path.resolve(__dirname, rel));

const COMMERCIAL_PILOT_ENV: PilotEnvSource = {
  SOPHIA_PILOT_MODE: 'true',
  PILOT_INVITE_ONLY: 'true',
  PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
  PILOT_LIVE_INFERENCE_ENABLED: 'true',
  PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
  BYOK_ENABLED: '1',
  PILOT_MAX_GENERATIONS: '20',
  PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
  PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
  PILOT_MODEL_ID: 'openai/gpt-4o-mini',
  PILOT_MAX_OUTPUT_TOKENS: '2048',
  PILOT_MAX_RETRIES: '1',
  PILOT_TIMEOUT_MS: '45000',
  PILOT_RATE_LIMIT_COOLDOWN_MS: '0',
};

function makeRequest(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  idempotencyKey?: string,
): NextRequest {
  const headers = new Headers();
  if (method === 'POST') {
    headers.set('content-type', 'application/json');
    headers.set('cookie', `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`);
    headers.set(CSRF_HEADER_NAME, CSRF_TOKEN);
    headers.set('idempotency-key', idempotencyKey ?? `idem-${crypto.randomUUID()}`);
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('Commercial Pilot Quota Enforcement (20 gens / $4.00 cap)', () => {
  let tmpDir: string;
  let sqlite: NodeSqliteD1Database;
  let clockMs: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-pilot-quota-'));
    sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'pilot.sqlite'));
    for (const mig of MIGRATIONS) {
      await sqlite.exec(fs.readFileSync(mig, 'utf8'));
    }
    clockMs = 1_795_500_000_000;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function buildDeps(overrides: Partial<FirstValueHttpDeps> = {}): FirstValueHttpDeps {
    const user = { id: 'usr_quota_1', email: 'pilot.customer@example.test' };
    return {
      getD1: async () => sqlite as unknown as D1Database,
      getCurrentUser: async () => user,
      verifyWorkspaceAccess: async (orgId, userId) => orgId === 'org_quota_1' && userId === user.id,
      verifyCsrf: verifyCsrfToken,
      listByokProviders: async () => ['openrouter', 'heygen'],
      signingSecret: SIGNING_SECRET,
      pilotEnv: COMMERCIAL_PILOT_ENV,
      nowMs: () => clockMs,
      lookupOpenRouterByokKey: async () => 'sk-or-v1-test-customer-byok-key',
      lookupHeyGenByokKey: async () => 'hg_test_customer_byok_key',
      generateLiveScript: async () => ({
        title: 'Commercial Quota Test Script',
        total_duration: 30,
        scenes: [
          {
            scene_number: 1,
            duration_estimate: 10,
            visual_description: 'Scene 1',
            narration: 'Hook narration',
          },
          {
            scene_number: 2,
            duration_estimate: 10,
            visual_description: 'Scene 2',
            narration: 'Body narration',
          },
          {
            scene_number: 3,
            duration_estimate: 10,
            visual_description: 'Scene 3',
            narration: 'CTA narration',
          },
        ],
      }),
      ...overrides,
    };
  }

  async function seedUsage(usedGenerations: number, estimatedSpendMicroUsd: number): Promise<void> {
    const d1 = sqlite as unknown as D1Database;
    await d1
      .prepare(
        `INSERT INTO pilot_usage_quotas (
           org_id, user_id, used_generations, estimated_spend_microusd, in_flight_until_ms,
           last_generation_at_iso, last_generation_at_ms, updated_at_iso
         ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .bind(
        'org_quota_1',
        'usr_quota_1',
        usedGenerations,
        estimatedSpendMicroUsd,
        new Date(clockMs - 60_000).toISOString(),
        clockMs - 60_000,
        new Date(clockMs - 60_000).toISOString(),
      )
      .run();
  }

  async function seedConsent(): Promise<void> {
    const d1 = sqlite as unknown as D1Database;
    await recordPilotConsent(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      policyVersion: PILOT_POLICY_VERSION,
      nowIso: new Date(clockMs - 120_000).toISOString(),
    });
  }

  it('preserves existing customer usage (1 gen / $0.02) safely under 20-gen / $4.00 cap without resetting counters', async () => {
    await seedUsage(1, 20_000); // 1 generation, $0.02
    const d1 = sqlite as unknown as D1Database;

    const before = await getPilotQuotaStatus(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      maxGenerations: 20,
      maxEstimatedSpendMicroUsd: 4_000_000,
    });
    expect(before.usedGenerations).toBe(1);
    expect(before.remainingGenerations).toBe(19);
    expect(before.estimatedSpendUsd).toBe(0.02);

    const reserved = await reservePilotGenerationSlot(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      maxGenerations: 20,
      cooldownMs: 0,
      nowMs: clockMs,
      maxEstimatedSpendMicroUsd: 4_000_000,
      estimatedCostPerAttemptMicroUsd: 20_000,
    });

    expect(reserved.outcome).toBe('reserved');
    expect(reserved.quota.usedGenerations).toBe(2);
    expect(reserved.quota.remainingGenerations).toBe(18);
    expect(reserved.quota.estimatedSpendUsd).toBe(0.04);
  });

  it('blocks new generations at >= 20 gens with clear error while keeping existing assets and poll_heygen_mp4 at 0 quota cost', async () => {
    await seedConsent();
    await seedUsage(20, 400_000); // At 20-generation cap ($0.40 spend)
    const d1 = sqlite as unknown as D1Database;

    const createdExport = await recordPilotMp4Export(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      artifactId: 'fvr_existing_1',
      renderMode: 'heygen_byok_mp4',
      heygenJobId: 'hg_job_quota_check_1',
      status: 'processing',
      durationSec: 30,
      width: 1080,
      height: 1920,
      codec: 'h264',
      ctaText: 'Try now',
      shortCode: 'quota01',
      referralUrl: 'https://example.test/r/quota01',
      nowIso: new Date(clockMs - 30_000).toISOString(),
    });

    const pollFn = vi.fn().mockResolvedValue({
      status: 'processing' as const,
    });

    const deps = buildDeps({ fetchHeyGenVideoStatus: pollFn });

    // 1. New generation is blocked with clear 429 error
    const genRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.test/api/first-value', {
        action: 'create_review',
        orgId: 'org_quota_1',
        missionId: 'mis_quota_1',
        topic: 'Blocked over quota',
        audience: 'Founders',
        provenance: 'live_provider',
      }),
      deps,
    );
    expect(genRes.status).toBe(429);
    const genJson = (await genRes.json()) as { error?: string; code?: string };
    expect(genJson.error ?? genJson.code).toBeTruthy();

    // 2. Existing assets remain accessible via GET
    const getRes = await handleFirstValueGet(
      makeRequest('GET', 'https://pilot.test/api/first-value?orgId=org_quota_1'),
      deps,
    );
    expect(getRes.status).toBe(200);

    // 3. poll_heygen_mp4 status check succeeds and consumes 0 generation allowance
    const pollRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.test/api/first-value', {
        action: 'poll_heygen_mp4',
        orgId: 'org_quota_1',
        exportId: createdExport.id,
      }),
      deps,
    );
    expect(pollRes.status).toBe(200);
    expect(pollFn).toHaveBeenCalledTimes(1);

    const after = await getPilotQuotaStatus(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      maxGenerations: 20,
      maxEstimatedSpendMicroUsd: 4_000_000,
    });
    expect(after.usedGenerations).toBe(20);
    expect(after.estimatedSpendUsd).toBe(0.4);
  });

  it('blocks new generations at >= $4.00 estimated spend while keeping poll_heygen_mp4 at 0 quota cost', async () => {
    await seedConsent();
    await seedUsage(5, 4_000_000); // Under 20 gens, but at $4.00 spend cap
    const d1 = sqlite as unknown as D1Database;

    const createdExport = await recordPilotMp4Export(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      artifactId: 'fvr_existing_2',
      renderMode: 'heygen_byok_mp4',
      heygenJobId: 'hg_job_spend_check_1',
      status: 'processing',
      durationSec: 30,
      width: 1080,
      height: 1920,
      codec: 'h264',
      ctaText: 'Try now',
      shortCode: 'spend01',
      referralUrl: 'https://example.test/r/spend01',
      nowIso: new Date(clockMs - 30_000).toISOString(),
    });

    const pollFn = vi.fn().mockResolvedValue({
      status: 'completed' as const,
      mediaUrl: 'https://cdn.heygen.com/video/done.mp4',
    });

    const deps = buildDeps({ fetchHeyGenVideoStatus: pollFn });

    const genRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.test/api/first-value', {
        action: 'create_review',
        orgId: 'org_quota_1',
        missionId: 'mis_quota_2',
        topic: 'Blocked over spend cap',
        audience: 'Founders',
        provenance: 'live_provider',
      }),
      deps,
    );
    expect(genRes.status).toBe(429);

    const pollRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.test/api/first-value', {
        action: 'poll_heygen_mp4',
        orgId: 'org_quota_1',
        exportId: createdExport.id,
      }),
      deps,
    );
    expect(pollRes.status).toBe(200);
    expect(pollFn).toHaveBeenCalledTimes(1);

    const after = await getPilotQuotaStatus(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      maxGenerations: 20,
      maxEstimatedSpendMicroUsd: 4_000_000,
    });
    expect(after.usedGenerations).toBe(5);
    expect(after.estimatedSpendUsd).toBe(4);
  });

  it('enforces atomic concurrent reservation safety without double-counting', async () => {
    await seedUsage(1, 20_000);
    const d1 = sqlite as unknown as D1Database;

    const [first, second] = await Promise.all([
      reservePilotGenerationSlot(d1, {
        orgId: 'org_quota_1',
        userId: 'usr_quota_1',
        maxGenerations: 20,
        cooldownMs: 0,
        nowMs: clockMs,
        maxEstimatedSpendMicroUsd: 4_000_000,
        estimatedCostPerAttemptMicroUsd: 20_000,
        inFlightLockMs: 60_000,
      }),
      reservePilotGenerationSlot(d1, {
        orgId: 'org_quota_1',
        userId: 'usr_quota_1',
        maxGenerations: 20,
        cooldownMs: 0,
        nowMs: clockMs,
        maxEstimatedSpendMicroUsd: 4_000_000,
        estimatedCostPerAttemptMicroUsd: 20_000,
        inFlightLockMs: 60_000,
      }),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(['in_flight', 'reserved']);

    const after = await getPilotQuotaStatus(d1, {
      orgId: 'org_quota_1',
      userId: 'usr_quota_1',
      maxGenerations: 20,
      maxEstimatedSpendMicroUsd: 4_000_000,
    });
    expect(after.usedGenerations).toBe(2);
    expect(after.estimatedSpendUsd).toBe(0.04);
  });

  it('requires customer-funded BYOK key and never performs automatic paid retries on failure', async () => {
    await seedConsent();
    const generateFn = vi.fn().mockRejectedValue(new Error('Upstream provider timeout'));

    // Missing customer BYOK key -> blocked before calling provider or consuming quota
    const noKeyDeps = buildDeps({
      lookupOpenRouterByokKey: async () => null,
      listByokProviders: async () => [],
      generateLiveScript: generateFn,
    });
    const noKeyRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.test/api/first-value', {
        action: 'create_review',
        orgId: 'org_quota_1',
        missionId: 'mis_quota_3',
        topic: 'No BYOK key test',
        audience: 'Founders',
        provenance: 'live_provider',
      }),
      noKeyDeps,
    );
    expect(noKeyRes.status).toBe(422);
    expect(generateFn).not.toHaveBeenCalled();

    // With customer BYOK key -> single attempt, zero automatic paid retries
    const withKeyDeps = buildDeps({ generateLiveScript: generateFn });
    const failRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.test/api/first-value', {
        action: 'create_review',
        orgId: 'org_quota_1',
        missionId: 'mis_quota_4',
        topic: 'Single attempt no retry test',
        audience: 'Founders',
        provenance: 'live_provider',
      }),
      withKeyDeps,
    );
    expect(failRes.status).toBeGreaterThanOrEqual(500);
    expect(generateFn).toHaveBeenCalledTimes(1);
  });
});
