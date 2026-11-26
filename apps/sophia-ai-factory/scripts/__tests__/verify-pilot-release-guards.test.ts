import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_0522_FILENAME,
  EXPECTED_0522_SHA256,
  EXPECTED_0523_FILENAME,
  EXPECTED_0524_FILENAME,
  EXPECTED_PILOT_D1_ID,
  EXPECTED_PILOT_D1_NAME,
  FORBIDDEN_PROD_D1_ID,
  FORBIDDEN_PROD_D1_NAME,
  REQUIRED_PILOT_FEEDBACK_COLUMNS,
  REQUIRED_PILOT_TABLES,
  assertPilotMigrationPolicy,
  inspectPilotMigrationDiff,
  verifyLivePilotBaseline,
  verifyPilotWranglerDatabaseTarget,
  verifyRemotePilotD1Schema,
} from '../verify-pilot-release-guards.mjs';

const BASE_SHA = '1111111111111111111111111111111111111111';
const TARGET_SHA = '2222222222222222222222222222222222222222';
const OTHER_SHA = '3333333333333333333333333333333333333333';

function findAppRoot(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, 'wrangler.pilot.toml')) || existsSync(resolve(dir, 'wrangler.toml'))) {
      return dir;
    }
    if (
      existsSync(resolve(dir, 'apps/sophia-ai-factory/wrangler.pilot.toml')) ||
      existsSync(resolve(dir, 'apps/sophia-ai-factory/wrangler.toml'))
    ) {
      return resolve(dir, 'apps/sophia-ai-factory');
    }
    dir = resolve(dir, '..');
  }
  throw new Error('Could not locate apps/sophia-ai-factory');
}

const APP_ROOT = findAppRoot();
const MIGRATIONS_DIR = resolve(APP_ROOT, 'migrations');
const WRANGLER_PILOT_TOML = resolve(APP_ROOT, 'wrangler.pilot.toml');
const HAS_PILOT_ARTIFACTS =
  existsSync(WRANGLER_PILOT_TOML) && existsSync(resolve(MIGRATIONS_DIR, EXPECTED_0522_FILENAME));

function makeJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createHealthyCloudflareFetch({
  liveCommitSha = BASE_SHA,
  pilotVersionId = 'pilot-ver-100',
  prodVersionId = 'prod-ver-999',
  appliedMigrations = [
    '0520_pilot_affiliate_revenue_studio.sql',
    '0521_pilot_commercial_validation.sql',
    EXPECTED_0522_FILENAME,
    EXPECTED_0523_FILENAME,
    EXPECTED_0524_FILENAME,
  ],
  tables = REQUIRED_PILOT_TABLES.map((name) => ({
    name,
    sql:
      name === 'pilot_affiliate_performance_entries'
        ? 'CREATE TABLE pilot_affiliate_performance_entries (id TEXT PRIMARY KEY, org_id TEXT, user_id TEXT, external_ref_id TEXT, UNIQUE (org_id, user_id, external_ref_id))'
        : `CREATE TABLE ${name} (id TEXT PRIMARY KEY)`,
  })),
  feedbackColumns = REQUIRED_PILOT_FEEDBACK_COLUMNS.map((name) => ({ name })),
} = {}) {
  return async (url: string, init?: { body?: string }) => {
    if (url.includes('/workers/scripts/sophia-ai-factory-pilot/deployments')) {
      return makeJsonResponse({
        success: true,
        result: {
          deployments: [
            { id: 'dep-pilot', versions: [{ version_id: pilotVersionId, percentage: 100 }] },
          ],
        },
      });
    }
    if (url.includes(`/workers/scripts/sophia-ai-factory-pilot/versions/${pilotVersionId}`)) {
      return makeJsonResponse({
        success: true,
        result: {
          id: pilotVersionId,
          resources: {
            bindings: [{ type: 'plain_text', name: 'COMMIT_SHA', text: liveCommitSha }],
          },
        },
      });
    }
    if (url.includes('/workers/scripts/sophia-ai-factory/deployments')) {
      return makeJsonResponse({
        success: true,
        result: {
          deployments: [
            { id: 'dep-prod', versions: [{ version_id: prodVersionId, percentage: 100 }] },
          ],
        },
      });
    }
    if (url.includes(`/d1/database/${EXPECTED_PILOT_D1_ID}/query`)) {
      const parsed = JSON.parse(init?.body ?? '{}') as { sql?: string };
      const sql = parsed.sql ?? '';
      if (sql.includes('d1_migrations')) {
        return makeJsonResponse({
          success: true,
          result: [{ success: true, results: appliedMigrations.map((name) => ({ name })) }],
        });
      }
      if (sql.includes('sqlite_master')) {
        return makeJsonResponse({
          success: true,
          result: [{ success: true, results: tables }],
        });
      }
      if (sql.includes('PRAGMA table_info(pilot_feedback)')) {
        return makeJsonResponse({
          success: true,
          result: [{ success: true, results: feedbackColumns }],
        });
      }
    }
    return makeJsonResponse({ success: false }, 404);
  };
}

describe('G1.1: inspectPilotMigrationDiff fail-closed behavior', () => {
  it('returns CLEAN when git diff exits 0 with empty stdout', () => {
    const res = inspectPilotMigrationDiff({
      baseSha: BASE_SHA,
      targetSha: TARGET_SHA,
      execGit: () => ({ status: 0, stdout: '', stderr: '' }),
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('CLEAN');
    expect(res.changedFiles).toEqual([]);
  });

  it('fails closed with MIGRATIONS_CHANGED when git diff reports changed migration files', () => {
    const res = inspectPilotMigrationDiff({
      baseSha: BASE_SHA,
      targetSha: TARGET_SHA,
      execGit: () => ({
        status: 0,
        stdout: 'apps/sophia-ai-factory/migrations/0525_new_pilot_table.sql\n',
        stderr: '',
      }),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('MIGRATIONS_CHANGED');
    expect(res.changedFiles).toEqual(['apps/sophia-ai-factory/migrations/0525_new_pilot_table.sql']);
  });

  it('fails closed with GIT_ERROR on real non-zero git exit and NEVER returns CLEAN', () => {
    const res = inspectPilotMigrationDiff({
      baseSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      targetSha: TARGET_SHA,
      cwd: APP_ROOT,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('GIT_ERROR');
    expect(res.exitCode).not.toBe(0);
  });
});

describe('G1.2: verifyLivePilotBaseline live Cloudflare API verification', () => {
  const validExecGit = (args: string[]) => {
    if (args[0] === 'rev-parse') {
      return { status: 0, stdout: `${BASE_SHA}\n`, stderr: '' };
    }
    if (args[0] === 'merge-base') {
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected git call' };
  };

  it('fails closed when pilot_expected_base_sha is missing', async () => {
    const res = await verifyLivePilotBaseline({
      expectedBaseSha: '',
      targetSha: TARGET_SHA,
      headSha: TARGET_SHA,
      accountId: 'acc-1',
      apiToken: 'tok-1',
      fetchFn: createHealthyCloudflareFetch(),
      execGit: validExecGit,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('INVALID_EXPECTED_BASE_SHA');
  });

  it('fails closed when checkout HEAD does not match targetSha (source substitution)', async () => {
    const res = await verifyLivePilotBaseline({
      expectedBaseSha: BASE_SHA,
      targetSha: TARGET_SHA,
      headSha: OTHER_SHA,
      accountId: 'acc-1',
      apiToken: 'tok-1',
      fetchFn: createHealthyCloudflareFetch(),
      execGit: validExecGit,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('SOURCE_SUBSTITUTION_HEAD_MISMATCH');
  });

  it('fails closed when expectedBaseSha is not an ancestor of targetSha', async () => {
    const res = await verifyLivePilotBaseline({
      expectedBaseSha: BASE_SHA,
      targetSha: TARGET_SHA,
      headSha: TARGET_SHA,
      accountId: 'acc-1',
      apiToken: 'tok-1',
      fetchFn: createHealthyCloudflareFetch(),
      execGit: (args: string[]) =>
        args[0] === 'rev-parse'
          ? { status: 0, stdout: `${BASE_SHA}\n`, stderr: '' }
          : { status: 1, stdout: '', stderr: 'not ancestor' },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('EXPECTED_BASE_SHA_NOT_ANCESTOR');
  });

  it('fails closed when live Pilot COMMIT_SHA mismatches expectedBaseSha', async () => {
    const res = await verifyLivePilotBaseline({
      expectedBaseSha: BASE_SHA,
      targetSha: TARGET_SHA,
      headSha: TARGET_SHA,
      accountId: 'acc-1',
      apiToken: 'tok-1',
      fetchFn: createHealthyCloudflareFetch({ liveCommitSha: OTHER_SHA }),
      execGit: validExecGit,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('LIVE_PILOT_BASELINE_MISMATCH');
  });

  it('passes and snapshots prodVersionBefore when live Pilot COMMIT_SHA matches expectedBaseSha', async () => {
    const res = await verifyLivePilotBaseline({
      expectedBaseSha: BASE_SHA,
      targetSha: TARGET_SHA,
      headSha: TARGET_SHA,
      accountId: 'acc-1',
      apiToken: 'tok-1',
      fetchFn: createHealthyCloudflareFetch({ prodVersionId: 'prod-v42' }),
      execGit: validExecGit,
    });
    expect(res.ok).toBe(true);
    expect(res.prodVersionBefore).toBe('prod-v42');
    expect(res.liveCommitSha).toBe(BASE_SHA);
  });
});

describe('G1.3: unsupported allow_pilot_migrations, wrangler D1 target, and remote D1 schema', () => {
  it('fails closed immediately when allow_pilot_migrations=true', () => {
    const res = assertPilotMigrationPolicy({ allowPilotMigrations: true });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('BLOCKED_UNSUPPORTED_PILOT_MIGRATION_PATH');
  });

  it.skipIf(!HAS_PILOT_ARTIFACTS)(
    'accepts real wrangler.pilot.toml targeting sophia-pilot-db and rejects sophia-raas-db',
    () => {
    const valid = verifyPilotWranglerDatabaseTarget({ wranglerPilotTomlPath: WRANGLER_PILOT_TOML });
    expect(valid.ok).toBe(true);
    expect(valid.databaseName).toBe(EXPECTED_PILOT_D1_NAME);
    expect(valid.databaseId).toBe(EXPECTED_PILOT_D1_ID);

    const poisoned = verifyPilotWranglerDatabaseTarget({
      tomlContent: `
[[d1_databases]]
binding = "DB"
database_name = "${FORBIDDEN_PROD_D1_NAME}"
database_id = "${FORBIDDEN_PROD_D1_ID}"
`,
    });
    expect(poisoned.ok).toBe(false);
    expect(poisoned.code).toBe('WRONG_PILOT_DATABASE_TARGET');
  });

  it('fails closed when remote D1 target is Production sophia-raas-db', async () => {
    const res = await verifyRemotePilotD1Schema({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      databaseId: FORBIDDEN_PROD_D1_ID,
      databaseName: FORBIDDEN_PROD_D1_NAME,
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createHealthyCloudflareFetch(),
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('WRONG_PILOT_DATABASE_TARGET');
  });

  it.skipIf(!HAS_PILOT_ARTIFACTS)(
    'fails closed when remote 0522 UNIQUE constraint or 0523/0524 feedback columns are missing',
    async () => {
    const missing0522 = await verifyRemotePilotD1Schema({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      databaseId: EXPECTED_PILOT_D1_ID,
      databaseName: EXPECTED_PILOT_D1_NAME,
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createHealthyCloudflareFetch({
        tables: REQUIRED_PILOT_TABLES.map((name) => ({
          name,
          sql: `CREATE TABLE ${name} (id TEXT PRIMARY KEY)`,
        })),
      }),
    });
    expect(missing0522.ok).toBe(false);
    expect(missing0522.SCHEMA_COMPATIBILITY).toBe('INCOMPATIBLE');
    expect(missing0522.has0522UniqueConstraint).toBe(false);

    const missing0524 = await verifyRemotePilotD1Schema({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      databaseId: EXPECTED_PILOT_D1_ID,
      databaseName: EXPECTED_PILOT_D1_NAME,
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createHealthyCloudflareFetch({
        feedbackColumns: [{ name: 'status' }, { name: 'operator_reply' }, { name: 'resolved_at_iso' }],
      }),
    });
    expect(missing0524.ok).toBe(false);
    expect(missing0524.missingFeedbackColumns).toEqual(['screenshot_data_url']);
  });

  it.skipIf(!HAS_PILOT_ARTIFACTS)(
    'passes with structured JSON verdict and pinned 0522 checksum when remote Pilot D1 is compatible',
    async () => {
    const res = await verifyRemotePilotD1Schema({
      accountId: 'acc-1',
      apiToken: 'tok-1',
      databaseId: EXPECTED_PILOT_D1_ID,
      databaseName: EXPECTED_PILOT_D1_NAME,
      migrationsDir: MIGRATIONS_DIR,
      fetchFn: createHealthyCloudflareFetch(),
    });
    expect(res.ok).toBe(true);
    expect(res.TARGET_DATABASE).toEqual({ name: EXPECTED_PILOT_D1_NAME, id: EXPECTED_PILOT_D1_ID });
    expect(res.UNEXPECTED_PENDING_MIGRATIONS).toEqual([]);
    expect(res.SCHEMA_COMPATIBILITY).toBe('COMPATIBLE');
    expect(res.MIGRATIONS_AUTHORIZED).toBe(false);
    expect(res.localChecksums['0522']).toBe(EXPECTED_0522_SHA256);
  });
});
