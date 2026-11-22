// @vitest-environment node
/**
 * Track B1.1 — Multi-Isolate Local D1 HTTP Journey & Security Test Suite (G2, G3, G6).
 *
 * Exercises 2+ independent Worker/D1 instances (`NodeSqliteD1Database`) against
 * the same local SQLite file with strict network isolation (`fetch` forbidden).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, verifyCsrfToken } from '@/seed/security/csrf';
import {
  createHonestValidationReceipt,
  type HonestValidationReceipt,
} from '@/tree/byok/honest-validation-receipt';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '@/land/first-value/first-value-http-handler';
import { FEATURE_PAYOS, isPayOsEnabled } from '@/seed/config/flags';
import cronPolicyJson from '@/seed/security/scheduled-cron-policy.json';

import type { NextResponse } from 'next/server';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

async function readJson<T>(res: NextResponse): Promise<T> {
  return (await res.json()) as T;
}

interface StatusJson {
  byokConfigured: boolean;
  receipt: HonestValidationReceipt;
}
interface CostPreviewJson {
  preview: { status: string };
  paidInferenceExecuted: boolean;
}
interface FixturePreviewJson {
  provenanceLabel: string;
}
interface ReviewResponseJson {
  review: DurableFirstValueReview;
  idempotentReplay?: boolean;
}
interface ExportResponseJson {
  export: { publicPublished: boolean; content: string };
}
interface ErrorResponseJson {
  code: string;
  error: string;
}

const SIGNING_SECRET = 'b1-1-test-signing-secret-32bytes-minimum';
const CSRF_TOKEN = 'csrf-token-b1-1-valid-0123456789abcdef';
const FIXED_NOW_MS = 1_795_300_000_000;
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../migrations/0515_first_value_reviews.sql',
);

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

function createWorkerDeps(
  d1: D1Database,
  opts: {
    userId?: string | null;
    allowedOrgId?: string;
    providers?: readonly string[];
    nowMs?: () => number;
  } = {},
): FirstValueHttpDeps {
  const userId = opts.userId === undefined ? 'user_a' : opts.userId;
  const allowedOrg = opts.allowedOrgId ?? 'org_a';
  return {
    getD1: async () => d1,
    getCurrentUser: async () => (userId ? { id: userId, email: `${userId}@example.com` } : null),
    verifyWorkspaceAccess: async (orgId, uid) => Boolean(uid) && orgId === allowedOrg,
    verifyCsrf: verifyCsrfToken,
    listByokProviders: async () => opts.providers ?? ['openrouter'],
    signingSecret: SIGNING_SECRET,
    nowMs: opts.nowMs ?? (() => FIXED_NOW_MS),
  };
}

async function makeSignedReceipt(
  overrides: Partial<{ userId: string; orgId: string; nowUnix: number }> = {},
): Promise<HonestValidationReceipt> {
  return createHonestValidationReceipt({
    userId: overrides.userId ?? 'user_a',
    orgId: overrides.orgId ?? 'org_a',
    provider: 'openrouter',
    maskedKey: 'sk-or-...1234',
    keyFormatAccepted: true,
    keyStoredSecurely: true,
    providerAuthStatus: 'untested',
    policyStatus: 'found',
    costBasis: 'estimated',
    nowUnix: overrides.nowUnix ?? Math.floor(FIXED_NOW_MS / 1000),
    signingSecret: SIGNING_SECRET,
  });
}

describe('B1.1 Durable First-Value HTTP Journey (multi-isolate D1)', () => {
  let tmpDir: string;
  let dbPath: string;
  let workerA: NodeSqliteD1Database;
  let workerB: NodeSqliteD1Database;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-b1-1-d1-'));
    dbPath = path.join(tmpDir, 'shared-d1.sqlite');
    workerA = new NodeSqliteD1Database(dbPath);
    workerB = new NodeSqliteD1Database(dbPath);
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    await workerA.exec(migrationSql);

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('NETWORK_ISOLATION_VIOLATION: external fetch is forbidden in B1.1 tests');
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('completes full HTTP journey across Worker A and Worker B with 0 MCU and zero network calls', async () => {
    const depsA = createWorkerDeps(workerA);
    const depsB = createWorkerDeps(workerB);

    // 1. Read-only GET status + honest signed receipt
    const statusRes = await handleFirstValueGet(
      makeRequest('GET', 'https://app.test/api/first-value?orgId=org_a'),
      depsA,
    );
    expect(statusRes.status).toBe(200);
    expect(statusRes.headers.get('cache-control')).toBe('private, no-store');
    const statusJson = await readJson<StatusJson>(statusRes);
    expect(statusJson.byokConfigured).toBe(true);
    expect(statusJson.receipt.providerAuthStatus).toBe('untested');
    expect(statusJson.receipt.paidInferenceExecuted).toBe(false);
    expect(JSON.stringify(statusJson)).not.toContain('sk-or-v1-');

    // 2. Honest cost_preview (available & unavailable)
    const costRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'cost_preview',
          orgId: 'org_a',
          provider: 'openrouter',
          model: 'google/gemini-2-5-flash',
          topic: 'Daily CEO video',
          audience: 'SMB owners',
          durationSec: 30,
        },
      }),
      depsA,
    );
    expect(costRes.status).toBe(200);
    const costJson = await readJson<CostPreviewJson>(costRes);
    expect(costJson.preview.status).toBe('COST_ESTIMATE_AVAILABLE');
    expect(costJson.paidInferenceExecuted).toBe(false);

    const unavailRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'cost_preview',
          orgId: 'org_a',
          provider: 'openrouter',
          model: null,
          topic: 'Daily CEO video',
          audience: 'SMB owners',
        },
      }),
      depsA,
    );
    expect(unavailRes.status).toBe(200);
    expect((await readJson<CostPreviewJson>(unavailRes)).preview.status).toBe(
      'COST_ESTIMATE_UNAVAILABLE',
    );

    // 3. fixture_preview
    const fixtureRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'fixture_preview',
          orgId: 'org_a',
          topic: 'Daily CEO video',
          audience: 'SMB owners',
          durationSec: 30,
        },
      }),
      depsA,
    );
    expect(fixtureRes.status).toBe(200);
    expect((await readJson<FixturePreviewJson>(fixtureRes)).provenanceLabel).toBe(
      'SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE',
    );

    // 4. create_review on Worker A
    const createRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        idempotencyKey: 'idem-create-journey-001',
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_001',
          topic: 'Daily CEO video',
          audience: 'SMB owners',
          durationSec: 30,
          receipt: statusJson.receipt,
        },
      }),
      depsA,
    );
    expect(createRes.status).toBe(201);
    const created = (await readJson<ReviewResponseJson>(createRes)).review;
    expect(created.provenance).toBe('fixture_simulated');
    expect(created.reviewState).toBe('pending_review');
    expect(created.version).toBe(1);
    expect(created.mcuCharged).toBe(0);
    expect(created.mcuAccountingRef).toBe('fixture:zero_mcu');

    // 5. Export before acceptance MUST fail (409)
    const earlyExportRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        idempotencyKey: 'idem-export-early-001',
        body: {
          action: 'private_export',
          orgId: 'org_a',
          artifactId: created.artifactId,
          format: 'markdown',
        },
      }),
      depsB,
    );
    expect(earlyExportRes.status).toBe(409);
    expect((await readJson<ErrorResponseJson>(earlyExportRes)).code).toBe('SCRIPT_NOT_ACCEPTED');

    // 6. Restart simulation: brand-new Worker C reads get_review, accepts, and exports
    const workerC = new NodeSqliteD1Database(dbPath);
    const depsC = createWorkerDeps(workerC);

    const getRes = await handleFirstValueGet(
      makeRequest(
        'GET',
        `https://app.test/api/first-value?orgId=org_a&artifactId=${created.artifactId}`,
      ),
      depsC,
    );
    expect(getRes.status).toBe(200);
    expect((await readJson<ReviewResponseJson>(getRes)).review.artifactId).toBe(created.artifactId);

    const acceptRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        idempotencyKey: 'idem-accept-001',
        body: {
          action: 'accept_review',
          orgId: 'org_a',
          artifactId: created.artifactId,
          expectedVersion: 1,
          explicitUserAction: true,
        },
      }),
      depsC,
    );
    expect(acceptRes.status).toBe(200);
    const accepted = (await readJson<ReviewResponseJson>(acceptRes)).review;
    expect(accepted.reviewState).toBe('accepted');
    expect(accepted.version).toBe(2);
    expect(accepted.acceptedAtIso).toBeTruthy();

    // 7. Export after accepted state succeeds privately
    const exportRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        idempotencyKey: 'idem-export-ok-001',
        body: {
          action: 'private_export',
          orgId: 'org_a',
          artifactId: created.artifactId,
          format: 'markdown',
        },
      }),
      depsB,
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('cache-control')).toBe('private, no-store');
    const exportJson = await readJson<ExportResponseJson>(exportRes);
    expect(exportJson.export.publicPublished).toBe(false);
    expect(exportJson.export.content).toContain('SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent duplicate creates across Worker A and Worker B', async () => {
    const receipt = await makeSignedReceipt();
    const depsA = createWorkerDeps(workerA);
    const depsB = createWorkerDeps(workerB);
    const body = {
      action: 'create_review',
      orgId: 'org_a',
      missionId: 'mission_dup',
      idempotencyKey: 'idem-concurrent-dup-001',
      topic: 'Concurrent topic',
      audience: 'Founders',
      durationSec: 30,
      receipt,
    };

    const [resA, resB] = await Promise.all([
      handleFirstValuePost(makeRequest('POST', 'https://app.test/api/first-value', { body }), depsA),
      handleFirstValuePost(makeRequest('POST', 'https://app.test/api/first-value', { body }), depsB),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 201]);
    const [jsonA, jsonB] = await Promise.all([
      readJson<ReviewResponseJson>(resA),
      readJson<ReviewResponseJson>(resB),
    ]);
    expect(jsonA.review.artifactId).toBe(jsonB.review.artifactId);
    expect([jsonA.idempotentReplay, jsonB.idempotentReplay].sort()).toEqual([false, true]);
  });

  it('rejects concurrent requests with same idempotency key but conflicting payloads (409)', async () => {
    const receipt = await makeSignedReceipt();
    const depsA = createWorkerDeps(workerA);
    const depsB = createWorkerDeps(workerB);

    const [resA, resB] = await Promise.all([
      handleFirstValuePost(
        makeRequest('POST', 'https://app.test/api/first-value', {
          body: {
            action: 'create_review',
            orgId: 'org_a',
            missionId: 'mission_conflict',
            idempotencyKey: 'idem-conflict-001',
            topic: 'Original Topic',
            audience: 'Founders',
            durationSec: 30,
            receipt,
          },
        }),
        depsA,
      ),
      handleFirstValuePost(
        makeRequest('POST', 'https://app.test/api/first-value', {
          body: {
            action: 'create_review',
            orgId: 'org_a',
            missionId: 'mission_conflict',
            idempotencyKey: 'idem-conflict-001',
            topic: 'Different Conflicting Topic',
            audience: 'Founders',
            durationSec: 30,
            receipt,
          },
        }),
        depsB,
      ),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const conflictBody =
      resA.status === 409
        ? await readJson<ErrorResponseJson>(resA)
        : await readJson<ErrorResponseJson>(resB);
    expect(conflictBody.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('handles accept/reject race, repeated accept, stale version, and rejection after acceptance', async () => {
    const receipt = await makeSignedReceipt();
    const depsA = createWorkerDeps(workerA);
    const depsB = createWorkerDeps(workerB);

    const createRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_race',
          idempotencyKey: 'idem-race-create-001',
          topic: 'Race topic',
          audience: 'CEOs',
          durationSec: 30,
          receipt,
        },
      }),
      depsA,
    );
    const artifactId = (await readJson<ReviewResponseJson>(createRes)).review.artifactId;

    // Stale version update while pending_review -> 409 STALE_VERSION
    const staleRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'accept_review',
          orgId: 'org_a',
          artifactId,
          expectedVersion: 99,
          explicitUserAction: true,
          idempotencyKey: 'idem-stale-001',
        },
      }),
      depsB,
    );
    expect(staleRes.status).toBe(409);
    expect((await readJson<ErrorResponseJson>(staleRes)).code).toBe('STALE_VERSION');

    // Accept / reject race across Worker A & Worker B
    const [raceAccept, raceReject] = await Promise.all([
      handleFirstValuePost(
        makeRequest('POST', 'https://app.test/api/first-value', {
          body: {
            action: 'accept_review',
            orgId: 'org_a',
            artifactId,
            expectedVersion: 1,
            explicitUserAction: true,
            idempotencyKey: 'idem-race-accept',
          },
        }),
        depsA,
      ),
      handleFirstValuePost(
        makeRequest('POST', 'https://app.test/api/first-value', {
          body: {
            action: 'reject_review',
            orgId: 'org_a',
            artifactId,
            expectedVersion: 1,
            explicitUserAction: true,
            reason: 'changed mind',
            idempotencyKey: 'idem-race-reject',
          },
        }),
        depsB,
      ),
    ]);
    expect([raceAccept.status, raceReject.status].sort((a, b) => a - b)).toEqual([200, 409]);

    // Ensure a dedicated accepted artifact tests repeated accept + rejection after acceptance
    const create2 = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_final',
          idempotencyKey: 'idem-final-create-002',
          topic: 'Finalized topic',
          audience: 'CEOs',
          durationSec: 30,
          receipt,
        },
      }),
      depsA,
    );
    const id2 = (await readJson<ReviewResponseJson>(create2)).review.artifactId;

    const firstAccept = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'accept_review',
          orgId: 'org_a',
          artifactId: id2,
          expectedVersion: 1,
          explicitUserAction: true,
          idempotencyKey: 'idem-accept-first',
        },
      }),
      depsA,
    );
    const accepted1 = (await readJson<ReviewResponseJson>(firstAccept)).review;

    // Repeated accept -> 200 idempotentReplay without mutating timestamp or version
    const repeatAccept = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'accept_review',
          orgId: 'org_a',
          artifactId: id2,
          expectedVersion: 1,
          explicitUserAction: true,
          idempotencyKey: 'idem-accept-repeat',
        },
      }),
      createWorkerDeps(workerB, { nowMs: () => FIXED_NOW_MS + 60_000 }),
    );
    expect(repeatAccept.status).toBe(200);
    const repeatJson = await readJson<ReviewResponseJson>(repeatAccept);
    expect(repeatJson.idempotentReplay).toBe(true);
    expect(repeatJson.review.version).toBe(accepted1.version);
    expect(repeatJson.review.acceptedAtIso).toBe(accepted1.acceptedAtIso);

    // Rejection after acceptance -> 409 REVIEW_ALREADY_FINALIZED
    const rejectAfterAccept = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'reject_review',
          orgId: 'org_a',
          artifactId: id2,
          expectedVersion: accepted1.version,
          explicitUserAction: true,
          reason: 'too late',
          idempotencyKey: 'idem-reject-after-accept',
        },
      }),
      depsB,
    );
    expect(rejectAfterAccept.status).toBe(409);
    expect((await readJson<ErrorResponseJson>(rejectAfterAccept)).code).toBe(
      'REVIEW_ALREADY_FINALIZED',
    );
  });

  it('blocks cross-tenant ID guessing, CSRF bypass, expired/malformed receipts, live_provider, and DB write failures', async () => {
    const receipt = await makeSignedReceipt();
    const depsA = createWorkerDeps(workerA);
    const depsTenantB = createWorkerDeps(workerB, { userId: 'user_b', allowedOrgId: 'org_b' });

    const createRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_sec',
          idempotencyKey: 'idem-sec-create-001',
          topic: 'Tenant A private script',
          audience: 'Board',
          durationSec: 30,
          receipt,
        },
      }),
      depsA,
    );
    const artifactId = (await readJson<ReviewResponseJson>(createRes)).review.artifactId;

    // Cross-tenant ID guessing (Org B user guesses Org A artifactId) -> 404 (no leak)
    const crossGet = await handleFirstValueGet(
      makeRequest('GET', `https://app.test/api/first-value?orgId=org_b&artifactId=${artifactId}`),
      depsTenantB,
    );
    expect(crossGet.status).toBe(404);

    // Cross-tenant org access attempt -> 403
    const crossOrg = await handleFirstValueGet(
      makeRequest('GET', `https://app.test/api/first-value?orgId=org_a&artifactId=${artifactId}`),
      depsTenantB,
    );
    expect(crossOrg.status).toBe(403);

    // Missing CSRF token -> 403
    const noCsrf = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        csrf: false,
        body: {
          action: 'fixture_preview',
          orgId: 'org_a',
          topic: 'x',
          audience: 'y',
        },
      }),
      depsA,
    );
    expect(noCsrf.status).toBe(403);

    // Expired receipt -> 403 INVALID_OR_EXPIRED_RECEIPT
    const expiredReceipt = await makeSignedReceipt({
      nowUnix: Math.floor(FIXED_NOW_MS / 1000) - 86_400,
    });
    const expiredRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_exp',
          idempotencyKey: 'idem-expired-001',
          topic: 'Expired',
          audience: 'CEOs',
          durationSec: 30,
          receipt: expiredReceipt,
        },
      }),
      depsA,
    );
    expect(expiredRes.status).toBe(403);
    expect((await readJson<ErrorResponseJson>(expiredRes)).code).toBe('INVALID_OR_EXPIRED_RECEIPT');

    // Malformed / tampered signature receipt -> 403
    const tamperedReceipt = {
      ...receipt,
      receiptIntegrity: { algorithm: 'hmac-sha256' as const, signature: '0'.repeat(64) },
    };
    const tamperedRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_tamp',
          idempotencyKey: 'idem-tampered-001',
          topic: 'Tampered',
          audience: 'CEOs',
          durationSec: 30,
          receipt: tamperedReceipt,
        },
      }),
      depsA,
    );
    expect(tamperedRes.status).toBe(403);

    // Live provider inference blocked -> 403 LIVE_INFERENCE_DISABLED
    const liveRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_live',
          idempotencyKey: 'idem-live-blocked-001',
          topic: 'Live attempt',
          audience: 'CEOs',
          durationSec: 30,
          provenance: 'live_provider',
          receipt,
        },
      }),
      depsA,
    );
    expect(liveRes.status).toBe(403);
    expect((await readJson<ErrorResponseJson>(liveRes)).code).toBe('LIVE_INFERENCE_DISABLED');

    // DB write failure after output creation -> 500 STORAGE_WRITE_FAILED, zero phantom state
    const failingD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            throw new Error('SQLITE_IOERR');
          },
          first: async () => null,
          all: async () => ({ results: [], success: true, meta: {} }),
        }),
      }),
    } as unknown as D1Database;

    const dbFailRes = await handleFirstValuePost(
      makeRequest('POST', 'https://app.test/api/first-value', {
        body: {
          action: 'create_review',
          orgId: 'org_a',
          missionId: 'mission_dbfail',
          idempotencyKey: 'idem-dbfail-001',
          topic: 'DB failure test',
          audience: 'CEOs',
          durationSec: 30,
          receipt,
        },
      }),
      createWorkerDeps(failingD1),
    );
    expect(dbFailRes.status).toBe(500);
    expect((await readJson<ErrorResponseJson>(dbFailRes)).code).toBe('STORAGE_WRITE_FAILED');
  });

  it('preserves cron policy regression (1 permitted / 39 blocked) and FEATURE_PAYOS=false', () => {
    const raw = cronPolicyJson as {
      registeredRoutes: string[];
      permittedRoutes: string[];
    };
    expect(raw.registeredRoutes).toHaveLength(40);
    expect(raw.permittedRoutes).toEqual(['/api/cron/d1-backup']);
    const blocked = raw.registeredRoutes.filter((r) => !raw.permittedRoutes.includes(r));
    expect(blocked).toHaveLength(39);
    expect(FEATURE_PAYOS).toBe(false);
    expect(isPayOsEnabled()).toBe(false);
  });
});
