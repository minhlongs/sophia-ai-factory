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
import { ProviderInvalidKeyError } from '@/seed/services/errors';
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
        PILOT_MAX_GENERATIONS: '2',
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
      expect.objectContaining({ apiKey: 'sk-or-v1-sponsored-pilot-test-key-000001' }),
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

  it('prefers BYOK over Founder-sponsored key, enforces cooldown + quota cap, and releases slot on provider failure', async () => {
    const generateSpy = vi
      .fn<NonNullable<FirstValueHttpDeps['generateLiveScript']>>()
      .mockRejectedValueOnce(new ProviderInvalidKeyError('openrouter', 'invalid key'))
      .mockResolvedValue(MOCK_REAL_SCRIPT);

    const deps = buildDeps({
      byokKey: 'sk-or-v1-customer-byok-key-0000001',
      generateLiveScript: generateSpy,
    });

    // Accept terms first
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

    // Attempt 1: Provider fails -> 422, slot released, GENERATION_FAILED logged
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
    expect(((await failRes.json()) as { code: string }).code).toBe('PROVIDER_KEY_INVALID');
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-or-v1-customer-byok-key-0000001' }),
    );

    // Advance past cooldown and verify quota was released (still 0 used -> succeeds twice)
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

    // Verify GENERATION_FAILED was also logged
    const failedEvent = await sqlite
      .prepare("SELECT COUNT(*) as cnt FROM pilot_events WHERE event_name = 'GENERATION_FAILED'")
      .first<{ cnt: number }>();
    expect(failedEvent?.cnt).toBe(1);
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
