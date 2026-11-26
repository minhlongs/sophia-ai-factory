import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_0522_FILENAME,
  EXPECTED_0523_FILENAME,
  EXPECTED_0524_FILENAME,
  EXPECTED_PILOT_D1_ID,
  REQUIRED_PILOT_FEEDBACK_COLUMNS,
  REQUIRED_PILOT_TABLES,
} from '../verify-pilot-release-guards.mjs';
import {
  DEFAULT_PILOT_URL,
  REQUIRED_PILOT_FEATURE_FLAGS,
  verifyPilotPostDeploy,
} from '../verify-pilot-post-deploy.mjs';

const TARGET_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const WRONG_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function findMigrationsDir(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, 'migrations'))) return resolve(dir, 'migrations');
    if (existsSync(resolve(dir, 'apps/sophia-ai-factory/migrations'))) {
      return resolve(dir, 'apps/sophia-ai-factory/migrations');
    }
    dir = resolve(dir, '..');
  }
  throw new Error('Could not locate migrations directory');
}

const MIGRATIONS_DIR = findMigrationsDir();
const HAS_PILOT_0522 = existsSync(resolve(MIGRATIONS_DIR, EXPECTED_0522_FILENAME));

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

function createPostDeployFetch({
  liveCommitSha = TARGET_SHA,
  pilotVersionId = 'pilot-v200',
  prodVersionAfter = 'prod-v100',
  featureFlagOverrides = {} as Record<string, string>,
  unauthHealthStatus = 302,
  unauthHealthLocation = 'https://agencyos.cloudflareaccess.com/cdn-cgi/access/login/sophia-pilot',
  authHealthStatus = 200,
} = {}) {
  const mergedFlags = { ...REQUIRED_PILOT_FEATURE_FLAGS, ...featureFlagOverrides };
  const bindings = [
    { type: 'plain_text', name: 'COMMIT_SHA', text: liveCommitSha },
    { type: 'd1', name: 'DB', id: EXPECTED_PILOT_D1_ID },
    ...Object.entries(mergedFlags).map(([name, text]) => ({
      type: 'plain_text',
      name,
      text,
    })),
  ];

  return async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
    if (url.includes('/workers/scripts/sophia-ai-factory-pilot/deployments')) {
      return makeJsonResponse({
        success: true,
        result: {
          deployments: [
            { id: 'dep-p', versions: [{ version_id: pilotVersionId, percentage: 100 }] },
          ],
        },
      });
    }
    if (url.includes(`/workers/scripts/sophia-ai-factory-pilot/versions/${pilotVersionId}`)) {
      return makeJsonResponse({
        success: true,
        result: { id: pilotVersionId, resources: { bindings } },
      });
    }
    if (url.includes('/workers/scripts/sophia-ai-factory/deployments')) {
      return makeJsonResponse({
        success: true,
        result: {
          deployments: [
            { id: 'dep-prod', versions: [{ version_id: prodVersionAfter, percentage: 100 }] },
          ],
        },
      });
    }
    if (url === `${DEFAULT_PILOT_URL}/api/health`) {
      const hasAccessHeaders = Boolean(init?.headers?.['CF-Access-Client-Id']);
      if (hasAccessHeaders) {
        return makeJsonResponse({ ok: true }, authHealthStatus);
      }
      return makeJsonResponse({}, unauthHealthStatus, { location: unauthHealthLocation });
    }
    if (url.includes(`/d1/database/${EXPECTED_PILOT_D1_ID}/query`)) {
      const parsed = JSON.parse(init?.body ?? '{}') as { sql?: string };
      const sql = parsed.sql ?? '';
      if (sql.includes('d1_migrations')) {
        return makeJsonResponse({
          success: true,
          result: [
            {
              success: true,
              results: [
                { name: '0520_pilot_affiliate_revenue_studio.sql' },
                { name: '0521_pilot_commercial_validation.sql' },
                { name: EXPECTED_0522_FILENAME },
                { name: EXPECTED_0523_FILENAME },
                { name: EXPECTED_0524_FILENAME },
              ],
            },
          ],
        });
      }
      if (sql.includes('sqlite_master')) {
        return makeJsonResponse({
          success: true,
          result: [
            {
              success: true,
              results: REQUIRED_PILOT_TABLES.map((name) => ({
                name,
                sql:
                  name === 'pilot_affiliate_performance_entries'
                    ? 'CREATE TABLE pilot_affiliate_performance_entries (org_id TEXT, user_id TEXT, external_ref_id TEXT, UNIQUE (org_id, user_id, external_ref_id))'
                    : `CREATE TABLE ${name} (id TEXT PRIMARY KEY)`,
              })),
            },
          ],
        });
      }
      if (sql.includes('PRAGMA table_info(pilot_feedback)')) {
        return makeJsonResponse({
          success: true,
          result: [
            {
              success: true,
              results: REQUIRED_PILOT_FEEDBACK_COLUMNS.map((name) => ({ name })),
            },
          ],
        });
      }
    }
    return makeJsonResponse({ success: false }, 404);
  };
}

describe('G1.4: verifyPilotPostDeploy behavioral verification', () => {
  it('fails closed when Cloudflare Access is bypassed (unauthenticated /api/health returns 200)', async () => {
    const res = await verifyPilotPostDeploy({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      expectedSha: TARGET_SHA,
      prodVersionBefore: 'prod-v100',
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createPostDeployFetch({ unauthHealthStatus: 200, unauthHealthLocation: '' }),
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('PILOT_ACCESS_SEAL_BYPASSED');
  });

  it('fails closed when active Pilot COMMIT_SHA does not match expectedSha', async () => {
    const res = await verifyPilotPostDeploy({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      expectedSha: TARGET_SHA,
      prodVersionBefore: 'prod-v100',
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createPostDeployFetch({ liveCommitSha: WRONG_SHA }),
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('PILOT_COMMIT_SHA_MISMATCH');
  });

  it('fails closed when a Pilot safety feature flag drifts', async () => {
    const res = await verifyPilotPostDeploy({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      expectedSha: TARGET_SHA,
      prodVersionBefore: 'prod-v100',
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createPostDeployFetch({ featureFlagOverrides: { PAYMENTS_ENABLED: 'true' } }),
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('PILOT_FEATURE_FLAG_MISMATCH');
  });

  it('fails closed with PRODUCTION_MUTATION_DETECTED when Production version drifts', async () => {
    const res = await verifyPilotPostDeploy({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      expectedSha: TARGET_SHA,
      prodVersionBefore: 'prod-v100',
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createPostDeployFetch({ prodVersionAfter: 'prod-v101-mutated' }),
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('PRODUCTION_MUTATION_DETECTED');
  });

  it.skipIf(!HAS_PILOT_0522)(
    'reports AUTHENTICATED_HEALTH_CHECK_UNCONFIGURED_ACCESS_SEAL_VERIFIED when Access service token is absent',
    async () => {
    const res = await verifyPilotPostDeploy({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      expectedSha: TARGET_SHA,
      prodVersionBefore: 'prod-v100',
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createPostDeployFetch(),
    });
    expect(res.ok).toBe(true);
    expect(res.accessSealVerified).toBe(true);
    expect(res.productionUnchanged).toBe(true);
    expect(res.authenticatedHealthStatus).toBe(
      'AUTHENTICATED_HEALTH_CHECK_UNCONFIGURED_ACCESS_SEAL_VERIFIED',
    );
  });

  it.skipIf(!HAS_PILOT_0522)(
    'reports AUTHENTICATED_HEALTH_CHECK_PASSED when Access service token is provided and returns 200',
    async () => {
    const res = await verifyPilotPostDeploy({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      expectedSha: TARGET_SHA,
      prodVersionBefore: 'prod-v100',
      accessClientId: 'cf-client-id',
      accessClientSecret: 'cf-client-secret',
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createPostDeployFetch({ authHealthStatus: 200 }),
    });
    expect(res.ok).toBe(true);
    expect(res.authenticatedHealthStatus).toBe('AUTHENTICATED_HEALTH_CHECK_PASSED');
  });
});
