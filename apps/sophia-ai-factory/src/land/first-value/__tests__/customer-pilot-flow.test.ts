// @vitest-environment node
/**
 * CUSTOMER-01 — End-to-End Customer Pilot Security, Quota, Editing & Telemetry Suite.
 *
 * Uses disposable test identities and mock AI inference only (no real provider calls,
 * no real customer data, no remote migrations).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import { PILOT_POLICY_VERSION, type PilotEnvSource } from '@/seed/pilot/pilot-access-policy';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, verifyCsrfToken } from '@/seed/security/csrf';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '@/land/first-value/first-value-http-handler';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

const CSRF_TOKEN = 'csrf-token-customer-pilot-0123456789abcdef';
const SIGNING_SECRET = 'pilot-test-signing-secret-32-bytes-ok';
const MIGRATION_B1 = path.resolve(
  __dirname,
  '../../../../migrations/0515_first_value_reviews.sql',
);
const MIGRATION_PILOT = path.resolve(
  __dirname,
  '../../../../migrations/0517_customer_pilot_first_value.sql',
);

const MOCK_REAL_SCRIPT: ScriptOutput = {
  title: 'Clinic 60-Second Patient Reminder',
  total_duration: 30,
  scenes: [
    {
      scene_number: 1,
      duration_estimate: 8,
      visual_description: 'Busy clinic front desk with missed call notifications',
      narration: 'Missing 40 percent of patient follow-ups quietly drains clinic revenue.',
    },
    {
      scene_number: 2,
      duration_estimate: 14,
      visual_description: 'Simple reminder checklist sent automatically to patient phone',
      narration: 'A 60-second reminder workflow confirms visits before chairs sit empty.',
    },
    {
      scene_number: 3,
      duration_estimate: 8,
      visual_description: 'Full appointment calendar and smiling receptionist',
      narration: 'Try the reminder template on your next ten patients this week.',
    },
  ],
};

function makeRequest(
  method: 'GET' | 'POST',
  url: string,
  opts?: { body?: unknown; csrf?: boolean; idempotencyKey?: string },
): NextRequest {
  const headers = new Headers();
  if (method === 'POST') {
    headers.set('content-type', 'application/json');
  }
  if (opts?.csrf !== false && method === 'POST') {
    headers.set('cookie', `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`);
    headers.set(CSRF_HEADER_NAME, CSRF_TOKEN);
  }
  if (opts?.idempotencyKey) {
    headers.set('idempotency-key', opts.idempotencyKey);
  }
  return new NextRequest(url, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('CUSTOMER-01 First Real Customer Pilot Journey (Isolated SQLite D1, Mock Inference)', () => {
  let tmpDir: string;
  let dbPath: string;
  let sqlite: NodeSqliteD1Database;
  let clockMs: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-pilot-01-'));
    dbPath = path.join(tmpDir, 'pilot.sqlite');
    sqlite = new NodeSqliteD1Database(dbPath);
    await sqlite.exec(fs.readFileSync(MIGRATION_B1, 'utf8'));
    await sqlite.exec(fs.readFileSync(MIGRATION_PILOT, 'utf8'));
    clockMs = 1_795_400_000_000;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function buildDeps(overrides: {
    user?: { id: string; email?: string | null } | null;
    allowedOrgId?: string;
    pilotEnv?: PilotEnvSource;
    byokKey?: string | null;
    generateLiveScript?: FirstValueHttpDeps['generateLiveScript'];
  } = {}): FirstValueHttpDeps {
    const user =
      overrides.user === undefined
        ? { id: 'usr_pilot_1', email: 'pilot.customer@example.test' }
        : overrides.user;
    const allowedOrgId = overrides.allowedOrgId ?? 'org_pilot_1';
    const byokKey = overrides.byokKey ?? null;

    return {
      getD1: async () => sqlite as unknown as D1Database,
      getCurrentUser: async () => user,
      verifyWorkspaceAccess: async (orgId, userId) =>
        orgId === allowedOrgId && Boolean(user && userId === user.id),
      verifyCsrf: verifyCsrfToken,
      listByokProviders: async () => (byokKey ? ['openrouter'] : []),
      signingSecret: SIGNING_SECRET,
      nowMs: () => clockMs,
      pilotEnv: overrides.pilotEnv ?? {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
        PILOT_LIVE_INFERENCE_ENABLED: 'true',
        PILOT_FINANCING_MODE: 'FOUNDER_SPONSORED',
        PILOT_MAX_GENERATIONS: '2',
        PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
        PILOT_RATE_LIMIT_COOLDOWN_MS: '5000',
        PILOT_OPENROUTER_API_KEY: 'sk-or-v1-sponsored-pilot-test-key-000001',
      },
      lookupOpenRouterByokKey: async () => byokKey,
      generateLiveScript:
        overrides.generateLiveScript ??
        vi.fn(async () => MOCK_REAL_SCRIPT),
    };
  }

  it('blocks uninvited users, revoked users, cross-tenant orgs, and missing CSRF', async () => {
    const uninvitedDeps = buildDeps({
      user: { id: 'usr_other', email: 'uninvited@example.test' },
    });
    const getBlocked = await handleFirstValueGet(
      makeRequest('GET', 'https://pilot.example.test/api/first-value?orgId=org_pilot_1'),
      uninvitedDeps,
    );
    expect(getBlocked.status).toBe(403);
    expect(((await getBlocked.json()) as { code: string }).code).toBe('PILOT_ACCESS_REVOKED');

    // Cross-tenant attempt by invited user
    const deps = buildDeps();
    const crossTenant = await handleFirstValueGet(
      makeRequest('GET', 'https://pilot.example.test/api/first-value?orgId=org_other_2'),
      deps,
    );
    expect(crossTenant.status).toBe(403);

    // Missing CSRF token
    const noCsrf = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        csrf: false,
        body: {
          action: 'accept_pilot_terms',
          orgId: 'org_pilot_1',
          policyVersion: PILOT_POLICY_VERSION,
          accepted: true,
        },
      }),
      deps,
    );
    expect(noCsrf.status).toBe(403);
  });

  it('enforces kill-switch and consent gate before live generation', async () => {
    const killSwitchDeps = buildDeps({
      pilotEnv: {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
        PILOT_LIVE_INFERENCE_ENABLED: 'false',
      },
    });
    const killedRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-kill-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      killSwitchDeps,
    );
    expect(killedRes.status).toBe(403);
    expect(((await killedRes.json()) as { code: string }).code).toBe('LIVE_INFERENCE_DISABLED');

    // Consent required before live generation
    const deps = buildDeps();
    const noConsentRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-noconsent-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(noConsentRes.status).toBe(403);
    expect(((await noConsentRes.json()) as { code: string }).code).toBe('PILOT_CONSENT_REQUIRED');
  });

  it('runs complete journey: consent -> live generate -> edit -> accept -> export -> feedback & logs all 10 events', async () => {
    const generateSpy = vi.fn(async () => MOCK_REAL_SCRIPT);
    const deps = buildDeps({ generateLiveScript: generateSpy });

    // 1. Accept pilot terms
    const consentRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        body: {
          action: 'accept_pilot_terms',
          orgId: 'org_pilot_1',
          policyVersion: PILOT_POLICY_VERSION,
          accepted: true,
        },
      }),
      deps,
    );
    expect(consentRes.status).toBe(200);

    // 2. Generate live script (Founder-sponsored mode since no BYOK key)
    const createRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-live-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as {
      review: DurableFirstValueReview;
      fundingMode: string;
      publicPublished: boolean;
      paidInferenceExecuted: boolean;
      quota: { usedGenerations: number; remainingGenerations: number };
    };
    expect(createJson.fundingMode).toBe('founder_sponsored');
    expect(createJson.publicPublished).toBe(false);
    expect(createJson.paidInferenceExecuted).toBe(true);
    expect(createJson.review.mcuCharged).toBe(0);
    expect(createJson.review.version).toBe(1);
    expect(createJson.quota.usedGenerations).toBe(1);
    expect(createJson.quota.remainingGenerations).toBe(1);
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-or-v1-sponsored-pilot-test-key-000001',
        model: 'openai/gpt-4o-mini',
        maxTokens: 2048,
        maxRetries: 1,
        timeoutMs: 45000,
        referer: 'https://pilot.sophia.agencyos.network',
      }),
    );

    // 3. Edit script inline (version 1 -> 2)
    const editedScript: ScriptOutput = {
      ...MOCK_REAL_SCRIPT,
      title: 'Clinic 60-Second Reminder (Edited)',
    };
    const editRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-edit-0001',
        body: {
          action: 'edit_review',
          orgId: 'org_pilot_1',
          artifactId: createJson.review.artifactId,
          expectedVersion: 1,
          script: editedScript,
        },
      }),
      deps,
    );
    expect(editRes.status).toBe(200);
    const editJson = (await editRes.json()) as { review: DurableFirstValueReview };
    expect(editJson.review.version).toBe(2);
    expect(editJson.review.script.title).toBe('Clinic 60-Second Reminder (Edited)');

    // Stale version edit rejected with 409
    const staleEditRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-edit-stale',
        body: {
          action: 'edit_review',
          orgId: 'org_pilot_1',
          artifactId: createJson.review.artifactId,
          expectedVersion: 1,
          script: editedScript,
        },
      }),
      deps,
    );
    expect(staleEditRes.status).toBe(409);

    // 4. Accept review (version 2 -> 3)
    const acceptRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-accept-0001',
        body: {
          action: 'accept_review',
          orgId: 'org_pilot_1',
          artifactId: createJson.review.artifactId,
          expectedVersion: 2,
          explicitUserAction: true,
        },
      }),
      deps,
    );
    expect(acceptRes.status).toBe(200);

    // Editing finalized review rejected with 409
    const editAfterAccept = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-edit-finalized',
        body: {
          action: 'edit_review',
          orgId: 'org_pilot_1',
          artifactId: createJson.review.artifactId,
          expectedVersion: 3,
          script: editedScript,
        },
      }),
      deps,
    );
    expect(editAfterAccept.status).toBe(409);

    // 5. Export markdown privately
    const exportRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-export-0001',
        body: {
          action: 'private_export',
          orgId: 'org_pilot_1',
          artifactId: createJson.review.artifactId,
          format: 'markdown',
        },
      }),
      deps,
    );
    expect(exportRes.status).toBe(200);
    const exportJson = (await exportRes.json()) as {
      export: { publicPublished: boolean; content: string };
    };
    expect(exportJson.export.publicPublished).toBe(false);
    expect(exportJson.export.content).toContain('Clinic 60-Second Reminder (Edited)');

    // 6. Submit customer feedback
    const feedbackRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        body: {
          action: 'submit_feedback',
          orgId: 'org_pilot_1',
          artifactId: createJson.review.artifactId,
          rating: 5,
          category: 'usefulness',
          comment: 'Clear 3-scene draft; only tweaked the title.',
        },
      }),
      deps,
    );
    expect(feedbackRes.status).toBe(201);

    // Verify 9 success-path events recorded in D1
    const eventsResult = await sqlite
      .prepare('SELECT event_name FROM pilot_events WHERE org_id = ? AND user_id = ?')
      .bind('org_pilot_1', 'usr_pilot_1')
      .all<{ event_name: string }>();
    const names = new Set((eventsResult.results ?? []).map((r) => r.event_name));
    expect(names.has('INVITE_ACCEPTED')).toBe(true);
    expect(names.has('FIRST_LOGIN')).toBe(true);
    expect(names.has('BRIEF_SUBMITTED')).toBe(true);
    expect(names.has('GENERATION_REQUESTED')).toBe(true);
    expect(names.has('GENERATION_SUCCEEDED')).toBe(true);
    expect(names.has('SCRIPT_EDITED')).toBe(true);
    expect(names.has('SCRIPT_REVIEWED')).toBe(true);
    expect(names.has('SCRIPT_EXPORTED')).toBe(true);
    expect(names.has('CUSTOMER_FEEDBACK_SUBMITTED')).toBe(true);
  });

  it('enforces single active financing mode with ZERO BYOK->Founder fallback, cooldown, and quota cap', async () => {
    const generateSpy = vi
      .fn<NonNullable<FirstValueHttpDeps['generateLiveScript']>>()
      .mockRejectedValueOnce(new ProviderInvalidKeyError('openrouter', 'invalid key'))
      .mockRejectedValueOnce(new ProviderQuotaExceededError('openrouter', 'insufficient credits'))
      .mockResolvedValue(MOCK_REAL_SCRIPT);

    const byokEnv: PilotEnvSource = {
      PILOT_INVITE_ONLY: 'true',
      PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
      PILOT_LIVE_INFERENCE_ENABLED: 'true',
      PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
      PILOT_MAX_GENERATIONS: '2',
      PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
      PILOT_RATE_LIMIT_COOLDOWN_MS: '5000',
      // Founder key is present in env, but MUST NEVER be used as fallback in CUSTOMER_BYOK mode!
      PILOT_OPENROUTER_API_KEY: 'sk-or-v1-sponsored-pilot-test-key-000001',
    };

    const noByokDeps = buildDeps({ pilotEnv: byokEnv, byokKey: null, generateLiveScript: generateSpy });
    await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        body: {
          action: 'accept_pilot_terms',
          orgId: 'org_pilot_1',
          policyVersion: PILOT_POLICY_VERSION,
          accepted: true,
        },
      }),
      noByokDeps,
    );

    // Missing customer BYOK key in CUSTOMER_BYOK mode -> 422 BYOK_KEY_REQUIRED (never falls back to Founder key)
    const missingByokRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-missing-byok',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      noByokDeps,
    );
    expect(missingByokRes.status).toBe(422);
    expect(((await missingByokRes.json()) as { code: string }).code).toBe('BYOK_KEY_REQUIRED');
    expect(generateSpy).not.toHaveBeenCalled();

    const deps = buildDeps({
      pilotEnv: byokEnv,
      byokKey: 'sk-or-v1-customer-byok-key-0000001',
      generateLiveScript: generateSpy,
    });

    // Attempt 1: Invalid BYOK key -> 422, slot refunded, NEVER falls back to Founder key
    const failRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-fail-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(failRes.status).toBe(422);
    expect(((await failRes.json()) as { code: string; quotaRefunded: boolean })).toMatchObject({
      code: 'PROVIDER_KEY_INVALID',
      quotaRefunded: true,
    });
    expect(generateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ apiKey: 'sk-or-v1-customer-byok-key-0000001' }),
    );

    // Attempt 2: Out-of-credit BYOK key -> 502 PROVIDER_QUOTA_EXCEEDED, slot refunded, NEVER falls back
    clockMs += 6000;
    const noCreditRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-fail-0002',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(noCreditRes.status).toBe(502);
    expect(((await noCreditRes.json()) as { code: string; quotaRefunded: boolean })).toMatchObject({
      code: 'PROVIDER_QUOTA_EXCEEDED',
      quotaRefunded: true,
    });

    // Advance past cooldown and verify quota was refunded (still 0 used -> succeeds twice)
    clockMs += 6000;
    const ok1 = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-ok-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder 1',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(ok1.status).toBe(201);
    expect(((await ok1.json()) as { fundingMode: string }).fundingMode).toBe('customer_byok');

    // Immediate retry within 5s cooldown -> 429 PILOT_RATE_LIMITED
    clockMs += 1000;
    const rateLimited = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-rl-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder 2',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(rateLimited.status).toBe(429);
    expect(((await rateLimited.json()) as { code: string }).code).toBe('PILOT_RATE_LIMITED');

    // Advance past cooldown -> 2nd generation succeeds (hits cap = 2)
    clockMs += 6000;
    const ok2 = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-ok-0002',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder 2',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(ok2.status).toBe(201);

    // Advance past cooldown -> 3rd generation blocked by hard cap (429 PILOT_QUOTA_EXCEEDED)
    clockMs += 6000;
    const capped = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-cap-0003',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder 3',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(capped.status).toBe(429);
    expect(((await capped.json()) as { code: string }).code).toBe('PILOT_QUOTA_EXCEEDED');

    // Verify GENERATION_FAILED was logged twice
    const failedEvent = await sqlite
      .prepare("SELECT COUNT(*) as cnt FROM pilot_events WHERE event_name = 'GENERATION_FAILED'")
      .first<{ cnt: number }>();
    expect(failedEvent?.cnt).toBe(2);
  });

  it('fails closed when cost controls are absent, enforces spend cap, concurrency lock, and conservative timeout accounting', async () => {
    // 1. Missing cost controls -> 503 PILOT_COST_CONTROLS_UNCONFIGURED
    const noCostControlsDeps = buildDeps({
      pilotEnv: {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
        PILOT_LIVE_INFERENCE_ENABLED: 'true',
        PILOT_FINANCING_MODE: 'FOUNDER_SPONSORED',
        PILOT_OPENROUTER_API_KEY: 'sk-or-v1-sponsored-pilot-test-key-000001',
      },
    });
    const blockedNoCost = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-nocost-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      noCostControlsDeps,
    );
    expect(blockedNoCost.status).toBe(503);
    expect(((await blockedNoCost.json()) as { code: string }).code).toBe(
      'PILOT_COST_CONTROLS_UNCONFIGURED',
    );

    // 2. Disabled financing mode -> 503 PILOT_FINANCING_DISABLED
    const disabledFinDeps = buildDeps({
      pilotEnv: {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
        PILOT_LIVE_INFERENCE_ENABLED: 'true',
        PILOT_FINANCING_MODE: 'DISABLED',
        PILOT_MAX_GENERATIONS: '20',
        PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
      },
    });
    const blockedFin = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-nofin-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      disabledFinDeps,
    );
    expect(blockedFin.status).toBe(503);
    expect(((await blockedFin.json()) as { code: string }).code).toBe('PILOT_FINANCING_DISABLED');

    // 3. Concurrency lock + conservative timeout accounting + spend cap
    let releaseFirstCall: () => void = () => {};
    const deferredCall = new Promise<ScriptOutput>((_resolve, reject) => {
      releaseFirstCall = () => reject(new Error('OpenRouter request timed out'));
    });

    const tightSpendEnv: PilotEnvSource = {
      PILOT_INVITE_ONLY: 'true',
      PILOT_ALLOWED_EMAILS: 'pilot.customer@example.test',
      PILOT_LIVE_INFERENCE_ENABLED: 'true',
      PILOT_FINANCING_MODE: 'FOUNDER_SPONSORED',
      PILOT_MAX_GENERATIONS: '20',
      PILOT_MAX_ESTIMATED_SPEND_USD: '0.02',
      PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
      PILOT_RATE_LIMIT_COOLDOWN_MS: '0',
      PILOT_OPENROUTER_API_KEY: 'sk-or-v1-sponsored-pilot-test-key-000001',
    };

    const deps = buildDeps({
      pilotEnv: tightSpendEnv,
      byokKey: 'sk-or-v1-customer-byok-ignored-in-founder-mode',
      generateLiveScript: vi.fn(() => deferredCall),
    });

    await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        body: {
          action: 'accept_pilot_terms',
          orgId: 'org_pilot_1',
          policyVersion: PILOT_POLICY_VERSION,
          accepted: true,
        },
      }),
      deps,
    );

    // Start request 1 (holds in-flight lock)
    const req1Promise = handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-inflight-0001',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder workflow',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );

    // Give microtasks a tick so req1 acquires the D1 lock
    await new Promise((r) => setTimeout(r, 15));

    // Concurrent request 2 while req1 is in-flight -> rejected before provider call!
    const req2Res = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-inflight-0002',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder concurrent',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(req2Res.status).toBe(429);
    const req2Code = ((await req2Res.json()) as { code: string }).code;
    expect(['PILOT_GENERATION_IN_PROGRESS', 'PILOT_SPEND_LIMIT_EXCEEDED']).toContain(req2Code);

    // Resolve req1 with timeout -> 502, conservative accounting retains slot & $0.02 spend
    releaseFirstCall();
    const req1Res = await req1Promise;
    expect(req1Res.status).toBe(502);
    expect(((await req1Res.json()) as { code: string; quotaRefunded: boolean })).toMatchObject({
      code: 'PROVIDER_GENERATION_FAILED',
      quotaRefunded: false,
    });

    // Next attempt is blocked by local spend cap ($0.02 used + $0.02 > $0.02 max) -> 429 PILOT_SPEND_LIMIT_EXCEEDED
    const spendBlocked = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-spendcap-0003',
        body: {
          action: 'create_review',
          orgId: 'org_pilot_1',
          missionId: 'mission_pilot_1',
          topic: 'Clinic reminder spend cap',
          audience: 'Clinic owners',
          durationSec: 30,
          provenance: 'live_provider',
        },
      }),
      deps,
    );
    expect(spendBlocked.status).toBe(429);
    expect(((await spendBlocked.json()) as { code: string }).code).toBe(
      'PILOT_SPEND_LIMIT_EXCEEDED',
    );
  });

  it('short-circuits idempotent live_provider replay before quota reservation or provider inference', async () => {
    const generateSpy = vi.fn(async () => MOCK_REAL_SCRIPT);
    const deps = buildDeps({ generateLiveScript: generateSpy });

    await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        body: {
          action: 'accept_pilot_terms',
          orgId: 'org_pilot_1',
          policyVersion: PILOT_POLICY_VERSION,
          accepted: true,
        },
      }),
      deps,
    );

    const payload = {
      action: 'create_review',
      orgId: 'org_pilot_1',
      missionId: 'mission_pilot_1',
      topic: 'Clinic reminder workflow',
      audience: 'Clinic owners',
      durationSec: 30,
      provenance: 'live_provider',
    };

    const firstRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-replay-0001',
        body: payload,
      }),
      deps,
    );
    expect(firstRes.status).toBe(201);
    expect(generateSpy).toHaveBeenCalledTimes(1);

    // Immediate replay with same key & payload: 200, NO second OpenRouter call, NO extra quota burn
    const replayRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-replay-0001',
        body: payload,
      }),
      deps,
    );
    expect(replayRes.status).toBe(200);
    const replayJson = (await replayRes.json()) as {
      idempotentReplay: boolean;
      paidInferenceExecuted: boolean;
      quota: { usedGenerations: number };
    };
    expect(replayJson.idempotentReplay).toBe(true);
    expect(replayJson.paidInferenceExecuted).toBe(false);
    expect(replayJson.quota.usedGenerations).toBe(1);
    expect(generateSpy).toHaveBeenCalledTimes(1);

    // Same key with DIFFERENT payload: 409 conflict, still NO second OpenRouter call
    const conflictRes = await handleFirstValuePost(
      makeRequest('POST', 'https://pilot.example.test/api/first-value', {
        idempotencyKey: 'idem-replay-0001',
        body: { ...payload, topic: 'Different clinic topic' },
      }),
      deps,
    );
    expect(conflictRes.status).toBe(409);
    expect(((await conflictRes.json()) as { code: string }).code).toBe(
      'IDEMPOTENCY_PAYLOAD_CONFLICT',
    );
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });
});
