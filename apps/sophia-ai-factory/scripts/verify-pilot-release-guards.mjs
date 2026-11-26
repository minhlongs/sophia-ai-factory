#!/usr/bin/env node
/**
 * Fail-Closed Pilot Release Governance Guards (G1.1, G1.2, G1.3).
 *
 * Enforces:
 *   G1.1 — Fail-closed migration range diff (CLEAN | MIGRATIONS_CHANGED | GIT_ERROR)
 *   G1.2 — Actual live Pilot baseline verification via Cloudflare Workers API
 *          (COMMIT_SHA binding on 100%-traffic active version) + Production version snapshot
 *   G1.3 — Disable unsupported allow_pilot_migrations=true path, verify wrangler.pilot.toml
 *          DB binding targets sophia-pilot-db (never sophia-raas-db), and inspect remote D1
 *          schema & migration inventory via read-only SELECT/PRAGMA queries.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PILOT_WORKER_NAME = 'sophia-ai-factory-pilot';
export const EXPECTED_PROD_WORKER_NAME = 'sophia-ai-factory';
export const EXPECTED_PILOT_D1_NAME = 'sophia-pilot-db';
export const EXPECTED_PILOT_D1_ID = 'd50fc9d9-dc3b-4fcd-bd3a-9efbf7524ed6';
export const FORBIDDEN_PROD_D1_NAME = 'sophia-raas-db';
export const FORBIDDEN_PROD_D1_ID = '78bd1961-b62d-43bb-b551-0c5d7d389506';

export const EXPECTED_0522_FILENAME = '0522_pilot_affiliate_performance_tenant_isolation.sql';
export const EXPECTED_0523_FILENAME = '0523_pilot_feedback_status_reply.sql';
export const EXPECTED_0524_FILENAME = '0524_pilot_feedback_screenshot.sql';
export const EXPECTED_0522_SHA256 =
  '7d3d8acd13675c9d3d1ecbd05f2babb075e9f91f0ace6a36b6e0c68a9f873b92';

export const REQUIRED_PILOT_TABLES = [
  'pilot_affiliate_campaigns',
  'pilot_mp4_exports',
  'pilot_affiliate_links',
  'pilot_usage_quotas',
  'pilot_affiliate_performance_entries',
  'pilot_feedback',
];

export const REQUIRED_PILOT_FEEDBACK_COLUMNS = [
  'status',
  'operator_reply',
  'resolved_at_iso',
  'screenshot_data_url',
];

const SHORT_OR_FULL_SHA_RE = /^[0-9a-fA-F]{7,40}$/;
const FULL_SHA_RE = /^[0-9a-fA-F]{40}$/;

function defaultExecGit(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function sha256File(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * G1.1: Fail-closed migration diff between baseSha and targetSha.
 * Explicitly distinguishes CLEAN, MIGRATIONS_CHANGED, and GIT_ERROR.
 */
export function inspectPilotMigrationDiff({
  baseSha,
  targetSha,
  cwd = process.cwd(),
  execGit = defaultExecGit,
}) {
  if (!baseSha || !SHORT_OR_FULL_SHA_RE.test(String(baseSha).trim())) {
    return {
      ok: false,
      status: 'GIT_ERROR',
      code: 'MIGRATION_DIFF_INVALID_BASE_SHA',
      changedFiles: [],
      exitCode: 1,
      detail: `Invalid baseSha: "${baseSha ?? ''}"`,
    };
  }
  if (!targetSha || !SHORT_OR_FULL_SHA_RE.test(String(targetSha).trim())) {
    return {
      ok: false,
      status: 'GIT_ERROR',
      code: 'MIGRATION_DIFF_INVALID_TARGET_SHA',
      changedFiles: [],
      exitCode: 1,
      detail: `Invalid targetSha: "${targetSha ?? ''}"`,
    };
  }

  const range = `${String(baseSha).trim()}..${String(targetSha).trim()}`;
  const args = ['diff', '--name-only', range, '--', ':(top)apps/sophia-ai-factory/migrations/'];

  let result;
  try {
    result = execGit(args, cwd);
  } catch (err) {
    return {
      ok: false,
      status: 'GIT_ERROR',
      code: 'MIGRATION_DIFF_GIT_ERROR',
      changedFiles: [],
      exitCode: 1,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (!result || result.error || result.status !== 0) {
    return {
      ok: false,
      status: 'GIT_ERROR',
      code: 'MIGRATION_DIFF_GIT_ERROR',
      changedFiles: [],
      exitCode: typeof result?.status === 'number' ? result.status : 1,
      detail:
        result?.error?.message ||
        (result?.stderr ? String(result.stderr).trim() : '') ||
        `git diff exited with status ${String(result?.status)}`,
    };
  }

  const changedFiles = String(result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (changedFiles.length > 0) {
    return {
      ok: false,
      status: 'MIGRATIONS_CHANGED',
      code: 'UNEXPECTED_PILOT_MIGRATIONS_CHANGED',
      changedFiles,
      exitCode: 0,
      detail: `Range ${range} modifies ${changedFiles.length} migration file(s).`,
    };
  }

  return {
    ok: true,
    status: 'CLEAN',
    code: 'MIGRATION_DIFF_CLEAN',
    changedFiles: [],
    exitCode: 0,
    detail: `No migration files changed in ${range}.`,
  };
}

/**
 * Helper: fetch active 100%-traffic Worker version from Cloudflare API.
 */
export async function fetchActiveWorkerDeployment({
  accountId,
  apiToken,
  workerName,
  includeVersionDetails = false,
  fetchFn = fetch,
}) {
  if (!accountId || !apiToken) {
    return {
      ok: false,
      code: 'MISSING_CLOUDFLARE_CREDENTIALS',
      detail: 'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.',
    };
  }

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  const deploymentsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/deployments`;
  let depRes;
  try {
    depRes = await fetchFn(deploymentsUrl, { method: 'GET', headers });
  } catch (err) {
    return {
      ok: false,
      code: 'CLOUDFLARE_API_NETWORK_ERROR',
      detail: `Failed to query deployments for ${workerName}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!depRes || !depRes.ok) {
    return {
      ok: false,
      code: 'CLOUDFLARE_DEPLOYMENTS_API_ERROR',
      detail: `Cloudflare deployments API for ${workerName} returned HTTP ${depRes?.status ?? 'unknown'}.`,
    };
  }

  const depJson = await depRes.json();
  if (!depJson?.success) {
    return {
      ok: false,
      code: 'CLOUDFLARE_DEPLOYMENTS_API_UNSUCCESSFUL',
      detail: `Cloudflare deployments API for ${workerName} returned success=false.`,
    };
  }

  const deployments = Array.isArray(depJson.result?.deployments)
    ? depJson.result.deployments
    : Array.isArray(depJson.result?.items)
      ? depJson.result.items
      : [];

  const latest = deployments[0];
  const versions = Array.isArray(latest?.versions) ? latest.versions : [];
  const activeVersion = versions.find((v) => Number(v.percentage) === 100);

  if (!activeVersion?.version_id) {
    return {
      ok: false,
      code: 'ACTIVE_100_PERCENT_VERSION_NOT_FOUND',
      detail: `No active 100%-traffic version found for worker ${workerName}.`,
    };
  }

  const versionId = String(activeVersion.version_id);

  if (!includeVersionDetails) {
    return { ok: true, versionId, deploymentId: latest?.id ?? null };
  }

  const versionUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/versions/${versionId}`;
  let verRes;
  try {
    verRes = await fetchFn(versionUrl, { method: 'GET', headers });
  } catch (err) {
    return {
      ok: false,
      code: 'CLOUDFLARE_VERSION_API_NETWORK_ERROR',
      detail: `Failed to query version ${versionId} for ${workerName}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!verRes || !verRes.ok) {
    return {
      ok: false,
      code: 'CLOUDFLARE_VERSION_API_ERROR',
      detail: `Cloudflare version API for ${workerName}/${versionId} returned HTTP ${verRes?.status ?? 'unknown'}.`,
    };
  }

  const verJson = await verRes.json();
  if (!verJson?.success || !verJson?.result) {
    return {
      ok: false,
      code: 'CLOUDFLARE_VERSION_API_UNSUCCESSFUL',
      detail: `Cloudflare version API for ${workerName}/${versionId} returned success=false.`,
    };
  }

  const bindings = Array.isArray(verJson.result?.resources?.bindings)
    ? verJson.result.resources.bindings
    : [];

  return {
    ok: true,
    versionId,
    deploymentId: latest?.id ?? null,
    bindings,
    rawVersion: verJson.result,
  };
}

/**
 * G1.2: Verify actual live Pilot baseline against Cloudflare Workers active version
 * and snapshot active Production Worker version_id.
 */
export async function verifyLivePilotBaseline({
  expectedBaseSha,
  targetSha,
  headSha,
  accountId,
  apiToken,
  workerName = EXPECTED_PILOT_WORKER_NAME,
  prodWorkerName = EXPECTED_PROD_WORKER_NAME,
  cwd = process.cwd(),
  fetchFn = fetch,
  execGit = defaultExecGit,
}) {
  const trimmedBase = String(expectedBaseSha ?? '').trim();
  const trimmedTarget = String(targetSha ?? '').trim();
  const trimmedHead = String(headSha ?? '').trim();

  if (!trimmedBase || !SHORT_OR_FULL_SHA_RE.test(trimmedBase)) {
    return {
      ok: false,
      code: 'INVALID_EXPECTED_BASE_SHA',
      detail: 'pilot_expected_base_sha is required and must be a 7-40 hex commit SHA.',
    };
  }
  if (!trimmedTarget || !FULL_SHA_RE.test(trimmedTarget)) {
    return {
      ok: false,
      code: 'INVALID_TARGET_SHA',
      detail: 'targetSha (github.sha) must be a 40-char hex commit SHA.',
    };
  }
  if (!trimmedHead || !FULL_SHA_RE.test(trimmedHead)) {
    return {
      ok: false,
      code: 'INVALID_HEAD_SHA',
      detail: 'headSha must be a 40-char hex commit SHA.',
    };
  }
  if (trimmedHead.toLowerCase() !== trimmedTarget.toLowerCase()) {
    return {
      ok: false,
      code: 'SOURCE_SUBSTITUTION_HEAD_MISMATCH',
      detail: `Checkout HEAD (${trimmedHead}) does not match targetSha (${trimmedTarget}).`,
    };
  }

  let resolveRes;
  try {
    resolveRes = execGit(['rev-parse', '--verify', `${trimmedBase}^{commit}`], cwd);
  } catch (err) {
    return {
      ok: false,
      code: 'EXPECTED_BASE_SHA_UNRESOLVABLE',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (!resolveRes || resolveRes.error || resolveRes.status !== 0) {
    return {
      ok: false,
      code: 'EXPECTED_BASE_SHA_UNRESOLVABLE',
      detail: `pilot_expected_base_sha "${trimmedBase}" does not resolve to a commit in this checkout.`,
    };
  }
  const resolvedBaseSha = String(resolveRes.stdout ?? '').trim();
  if (!FULL_SHA_RE.test(resolvedBaseSha)) {
    return {
      ok: false,
      code: 'EXPECTED_BASE_SHA_UNRESOLVABLE',
      detail: `Resolved base SHA "${resolvedBaseSha}" is not a 40-char commit SHA.`,
    };
  }

  let ancestorRes;
  try {
    ancestorRes = execGit(['merge-base', '--is-ancestor', resolvedBaseSha, trimmedTarget], cwd);
  } catch (err) {
    return {
      ok: false,
      code: 'EXPECTED_BASE_SHA_NOT_ANCESTOR',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (!ancestorRes || ancestorRes.error || ancestorRes.status !== 0) {
    return {
      ok: false,
      code: 'EXPECTED_BASE_SHA_NOT_ANCESTOR',
      detail: `pilot_expected_base_sha "${resolvedBaseSha}" is not an ancestor of "${trimmedTarget}".`,
    };
  }

  const pilotLive = await fetchActiveWorkerDeployment({
    accountId,
    apiToken,
    workerName,
    includeVersionDetails: true,
    fetchFn,
  });
  if (!pilotLive.ok) {
    return {
      ok: false,
      code: 'LIVE_PILOT_BASELINE_FETCH_FAILED',
      detail: pilotLive.detail,
      upstreamCode: pilotLive.code,
    };
  }

  const commitBinding = pilotLive.bindings.find(
    (b) => b && b.type === 'plain_text' && b.name === 'COMMIT_SHA',
  );
  const liveCommitSha = String(commitBinding?.text ?? '').trim();

  if (!liveCommitSha || !FULL_SHA_RE.test(liveCommitSha)) {
    return {
      ok: false,
      code: 'LIVE_PILOT_COMMIT_SHA_MISSING',
      detail: `Active Pilot version ${pilotLive.versionId} is missing a valid 40-char COMMIT_SHA plain_text binding.`,
    };
  }

  if (resolvedBaseSha.toLowerCase() !== liveCommitSha.toLowerCase()) {
    return {
      ok: false,
      code: 'LIVE_PILOT_BASELINE_MISMATCH',
      detail: `Expected base SHA (${resolvedBaseSha}) does not match live Pilot COMMIT_SHA (${liveCommitSha}).`,
      expectedBaseSha: resolvedBaseSha,
      liveCommitSha,
    };
  }

  const prodLive = await fetchActiveWorkerDeployment({
    accountId,
    apiToken,
    workerName: prodWorkerName,
    includeVersionDetails: false,
    fetchFn,
  });
  if (!prodLive.ok) {
    return {
      ok: false,
      code: 'PROD_VERSION_SNAPSHOT_FAILED',
      detail: prodLive.detail,
      upstreamCode: prodLive.code,
    };
  }

  return {
    ok: true,
    code: 'LIVE_PILOT_BASELINE_VERIFIED',
    expectedBaseSha: resolvedBaseSha,
    liveCommitSha,
    pilotVersionId: pilotLive.versionId,
    prodVersionBefore: prodLive.versionId,
  };
}

/**
 * G1.3a: Fail closed immediately when unsupported allow_pilot_migrations=true is requested.
 */
export function assertPilotMigrationPolicy({ allowPilotMigrations }) {
  const enabled =
    allowPilotMigrations === true ||
    String(allowPilotMigrations ?? '')
      .trim()
      .toLowerCase() === 'true';

  if (enabled) {
    return {
      ok: false,
      code: 'BLOCKED_UNSUPPORTED_PILOT_MIGRATION_PATH',
      detail:
        'allow_pilot_migrations=true is disabled: it is not an authorized migration execution procedure. Zero-migration mode is strictly required until a governed Pilot migration workflow exists.',
    };
  }

  return {
    ok: true,
    code: 'ZERO_MIGRATION_MODE_ENFORCED',
    migrationsAuthorized: false,
  };
}

/**
 * G1.3b: Verify wrangler.pilot.toml primary DB binding targets sophia-pilot-db only.
 */
export function verifyPilotWranglerDatabaseTarget({ wranglerPilotTomlPath, tomlContent }) {
  const content =
    typeof tomlContent === 'string'
      ? tomlContent
      : wranglerPilotTomlPath && existsSync(wranglerPilotTomlPath)
        ? readFileSync(wranglerPilotTomlPath, 'utf8')
        : null;

  if (!content) {
    return {
      ok: false,
      code: 'WRONG_PILOT_DATABASE_TARGET',
      detail: `Unable to read wrangler.pilot.toml at "${wranglerPilotTomlPath ?? ''}".`,
    };
  }

  const blocks = content.split(/^\s*\[\[d1_databases\]\]\s*$/m).slice(1);
  let dbBlock = null;
  for (const rawBlock of blocks) {
    const section = rawBlock.split(/^\s*\[/m)[0];
    const bindingMatch = section.match(/^\s*binding\s*=\s*"([^"]+)"/m);
    if (bindingMatch?.[1] === 'DB') {
      dbBlock = section;
      break;
    }
  }

  if (!dbBlock) {
    return {
      ok: false,
      code: 'WRONG_PILOT_DATABASE_TARGET',
      detail: 'wrangler.pilot.toml is missing primary [[d1_databases]] binding = "DB".',
    };
  }

  const dbName = dbBlock.match(/^\s*database_name\s*=\s*"([^"]+)"/m)?.[1] ?? '';
  const dbId = dbBlock.match(/^\s*database_id\s*=\s*"([^"]+)"/m)?.[1] ?? '';

  if (
    dbName === FORBIDDEN_PROD_D1_NAME ||
    dbId === FORBIDDEN_PROD_D1_ID ||
    dbName !== EXPECTED_PILOT_D1_NAME ||
    dbId !== EXPECTED_PILOT_D1_ID
  ) {
    return {
      ok: false,
      code: 'WRONG_PILOT_DATABASE_TARGET',
      detail: `Primary DB binding resolved to "${dbName}" (${dbId}), expected "${EXPECTED_PILOT_D1_NAME}" (${EXPECTED_PILOT_D1_ID}).`,
      databaseName: dbName,
      databaseId: dbId,
    };
  }

  return {
    ok: true,
    code: 'PILOT_DATABASE_TARGET_VERIFIED',
    databaseName: dbName,
    databaseId: dbId,
  };
}

async function queryD1ReadOnly({ accountId, apiToken, databaseId, sql, fetchFn }) {
  const normalized = String(sql).trim().toUpperCase();
  if (!normalized.startsWith('SELECT ') && !normalized.startsWith('PRAGMA ')) {
    throw new Error(`Refusing non-read-only D1 SQL in governance guard: ${sql}`);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  if (!res || !res.ok) {
    throw new Error(`Cloudflare D1 query API returned HTTP ${res?.status ?? 'unknown'}`);
  }

  const json = await res.json();
  if (!json?.success || !Array.isArray(json.result) || !json.result[0]?.success) {
    throw new Error(`Cloudflare D1 query failed for SQL: ${sql}`);
  }

  return Array.isArray(json.result[0].results) ? json.result[0].results : [];
}

/**
 * G1.3c: Read-only remote Pilot D1 schema & migration inventory verification.
 */
export async function verifyRemotePilotD1Schema({
  accountId,
  apiToken,
  databaseId = EXPECTED_PILOT_D1_ID,
  databaseName = EXPECTED_PILOT_D1_NAME,
  migrationsDir,
  fetchFn = fetch,
}) {
  if (
    databaseName === FORBIDDEN_PROD_D1_NAME ||
    databaseId === FORBIDDEN_PROD_D1_ID ||
    databaseName !== EXPECTED_PILOT_D1_NAME ||
    databaseId !== EXPECTED_PILOT_D1_ID
  ) {
    return {
      ok: false,
      code: 'WRONG_PILOT_DATABASE_TARGET',
      TARGET_DATABASE: { name: databaseName, id: databaseId },
      UNEXPECTED_PENDING_MIGRATIONS: [],
      SCHEMA_COMPATIBILITY: 'INCOMPATIBLE',
      MIGRATIONS_AUTHORIZED: false,
      detail: `Refusing to inspect non-Pilot database "${databaseName}" (${databaseId}).`,
    };
  }

  if (!accountId || !apiToken) {
    return {
      ok: false,
      code: 'MISSING_CLOUDFLARE_CREDENTIALS',
      TARGET_DATABASE: { name: databaseName, id: databaseId },
      UNEXPECTED_PENDING_MIGRATIONS: [],
      SCHEMA_COMPATIBILITY: 'INCOMPATIBLE',
      MIGRATIONS_AUTHORIZED: false,
      detail: 'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.',
    };
  }

  const localChecksums = {};
  let localPilotMigrationFiles = [];
  if (migrationsDir && existsSync(migrationsDir)) {
    const f0522 = resolve(migrationsDir, EXPECTED_0522_FILENAME);
    const f0523 = resolve(migrationsDir, EXPECTED_0523_FILENAME);
    const f0524 = resolve(migrationsDir, EXPECTED_0524_FILENAME);
    if (!existsSync(f0522) || !existsSync(f0523) || !existsSync(f0524)) {
      return {
        ok: false,
        code: 'LOCAL_PILOT_MIGRATION_FILE_MISSING',
        TARGET_DATABASE: { name: databaseName, id: databaseId },
        UNEXPECTED_PENDING_MIGRATIONS: [],
        SCHEMA_COMPATIBILITY: 'INCOMPATIBLE',
        MIGRATIONS_AUTHORIZED: false,
        detail: 'One or more required local Pilot migration files (0522/0523/0524) are missing.',
      };
    }
    localChecksums['0522'] = sha256File(f0522);
    localChecksums['0523'] = sha256File(f0523);
    localChecksums['0524'] = sha256File(f0524);

    if (localChecksums['0522'] !== EXPECTED_0522_SHA256) {
      return {
        ok: false,
        code: 'MIGRATION_0522_CHECKSUM_MISMATCH',
        TARGET_DATABASE: { name: databaseName, id: databaseId },
        UNEXPECTED_PENDING_MIGRATIONS: [],
        SCHEMA_COMPATIBILITY: 'INCOMPATIBLE',
        MIGRATIONS_AUTHORIZED: false,
        localChecksums,
        detail: `Local 0522 SHA-256 (${localChecksums['0522']}) does not match pinned checksum (${EXPECTED_0522_SHA256}).`,
      };
    }

    localPilotMigrationFiles = readdirSync(migrationsDir)
      .filter((name) => /^052\d+.*\.sql$/.test(name))
      .sort();
  }

  let appliedMigrationsRows;
  let sqliteMasterRows;
  let feedbackColumnsRows;

  try {
    appliedMigrationsRows = await queryD1ReadOnly({
      accountId,
      apiToken,
      databaseId,
      sql: 'SELECT name FROM d1_migrations ORDER BY name;',
      fetchFn,
    });
    sqliteMasterRows = await queryD1ReadOnly({
      accountId,
      apiToken,
      databaseId,
      sql: "SELECT name, sql FROM sqlite_master WHERE type = 'table';",
      fetchFn,
    });
    feedbackColumnsRows = await queryD1ReadOnly({
      accountId,
      apiToken,
      databaseId,
      sql: 'PRAGMA table_info(pilot_feedback);',
      fetchFn,
    });
  } catch (err) {
    return {
      ok: false,
      code: 'REMOTE_D1_QUERY_FAILED',
      TARGET_DATABASE: { name: databaseName, id: databaseId },
      UNEXPECTED_PENDING_MIGRATIONS: [],
      SCHEMA_COMPATIBILITY: 'INCOMPATIBLE',
      MIGRATIONS_AUTHORIZED: false,
      localChecksums,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const appliedNames = new Set(appliedMigrationsRows.map((r) => String(r?.name ?? '').trim()));
  const tableMap = new Map(
    sqliteMasterRows.map((r) => [String(r?.name ?? '').trim(), String(r?.sql ?? '')]),
  );
  const feedbackCols = new Set(feedbackColumnsRows.map((r) => String(r?.name ?? '').trim()));

  const missingTables = REQUIRED_PILOT_TABLES.filter((t) => !tableMap.has(t));
  const perfSql = tableMap.get('pilot_affiliate_performance_entries') ?? '';
  const has0522UniqueConstraint = /UNIQUE\s*\(\s*org_id\s*,\s*user_id\s*,\s*external_ref_id\s*\)/i.test(
    perfSql,
  );
  const missingFeedbackColumns = REQUIRED_PILOT_FEEDBACK_COLUMNS.filter(
    (col) => !feedbackCols.has(col),
  );

  const requiredMigrations = [
    EXPECTED_0522_FILENAME,
    EXPECTED_0523_FILENAME,
    EXPECTED_0524_FILENAME,
  ];
  const expectedPilotSet = new Set([...requiredMigrations, ...localPilotMigrationFiles]);
  const unexpectedPending = Array.from(expectedPilotSet)
    .filter((name) => !appliedNames.has(name))
    .sort();

  const schemaErrors = [];
  if (missingTables.length > 0) {
    schemaErrors.push(`Missing Pilot tables: ${missingTables.join(', ')}`);
  }
  if (!has0522UniqueConstraint) {
    schemaErrors.push(
      'pilot_affiliate_performance_entries is missing 0522 UNIQUE (org_id, user_id, external_ref_id)',
    );
  }
  if (missingFeedbackColumns.length > 0) {
    schemaErrors.push(
      `pilot_feedback is missing columns: ${missingFeedbackColumns.join(', ')}`,
    );
  }
  if (unexpectedPending.length > 0) {
    schemaErrors.push(`Unexpected pending Pilot migrations: ${unexpectedPending.join(', ')}`);
  }

  if (schemaErrors.length > 0) {
    return {
      ok: false,
      code:
        unexpectedPending.length > 0 && missingTables.length === 0 && has0522UniqueConstraint && missingFeedbackColumns.length === 0
          ? 'UNEXPECTED_PENDING_PILOT_MIGRATIONS'
          : 'REMOTE_PILOT_D1_SCHEMA_INCOMPATIBLE',
      TARGET_DATABASE: { name: databaseName, id: databaseId },
      UNEXPECTED_PENDING_MIGRATIONS: unexpectedPending,
      SCHEMA_COMPATIBILITY: 'INCOMPATIBLE',
      MIGRATIONS_AUTHORIZED: false,
      missingTables,
      has0522UniqueConstraint,
      missingFeedbackColumns,
      localChecksums,
      detail: schemaErrors.join('; '),
    };
  }

  return {
    ok: true,
    code: 'REMOTE_PILOT_D1_SCHEMA_COMPATIBLE',
    TARGET_DATABASE: { name: databaseName, id: databaseId },
    UNEXPECTED_PENDING_MIGRATIONS: [],
    SCHEMA_COMPATIBILITY: 'COMPATIBLE',
    MIGRATIONS_AUTHORIZED: false,
    has0522UniqueConstraint: true,
    localChecksums,
  };
}

/**
 * Full G1.1 + G1.2 + G1.3 orchestrator.
 */
export async function runPilotReleaseGuards({
  allowPilotMigrations = false,
  expectedBaseSha,
  targetSha,
  headSha,
  accountId,
  apiToken,
  wranglerPilotTomlPath,
  migrationsDir,
  cwd = process.cwd(),
  fetchFn = fetch,
  execGit = defaultExecGit,
}) {
  const policy = assertPilotMigrationPolicy({ allowPilotMigrations });
  if (!policy.ok) {
    return { ok: false, stage: 'G1.3-policy', code: policy.code, detail: policy.detail, policy };
  }

  const dbTarget = verifyPilotWranglerDatabaseTarget({ wranglerPilotTomlPath });
  if (!dbTarget.ok) {
    return {
      ok: false,
      stage: 'G1.3-wrangler-db-target',
      code: dbTarget.code,
      detail: dbTarget.detail,
      dbTarget,
    };
  }

  const baseline = await verifyLivePilotBaseline({
    expectedBaseSha,
    targetSha,
    headSha,
    accountId,
    apiToken,
    cwd,
    fetchFn,
    execGit,
  });
  if (!baseline.ok) {
    return {
      ok: false,
      stage: 'G1.2-live-baseline',
      code: baseline.code,
      detail: baseline.detail,
      baseline,
    };
  }

  const migrationDiff = inspectPilotMigrationDiff({
    baseSha: baseline.expectedBaseSha,
    targetSha,
    cwd,
    execGit,
  });
  if (!migrationDiff.ok) {
    return {
      ok: false,
      stage: 'G1.1-migration-diff',
      code: migrationDiff.code,
      detail: migrationDiff.detail,
      migrationDiff,
      baseline,
    };
  }

  const d1Schema = await verifyRemotePilotD1Schema({
    accountId,
    apiToken,
    databaseId: dbTarget.databaseId,
    databaseName: dbTarget.databaseName,
    migrationsDir,
    fetchFn,
  });
  if (!d1Schema.ok) {
    return {
      ok: false,
      stage: 'G1.3-remote-d1-schema',
      code: d1Schema.code,
      detail: d1Schema.detail,
      d1Schema,
      baseline,
      migrationDiff,
    };
  }

  return {
    ok: true,
    code: 'PILOT_RELEASE_GUARDS_PASSED',
    prodVersionBefore: baseline.prodVersionBefore,
    liveCommitSha: baseline.liveCommitSha,
    pilotVersionId: baseline.pilotVersionId,
    TARGET_DATABASE: d1Schema.TARGET_DATABASE,
    UNEXPECTED_PENDING_MIGRATIONS: d1Schema.UNEXPECTED_PENDING_MIGRATIONS,
    SCHEMA_COMPATIBILITY: d1Schema.SCHEMA_COMPATIBILITY,
    MIGRATIONS_AUTHORIZED: d1Schema.MIGRATIONS_AUTHORIZED,
    migrationDiff,
    baseline,
    d1Schema,
  };
}

async function main() {
  const cwd = process.cwd();
  const headRes = defaultExecGit(['rev-parse', 'HEAD'], cwd);
  const headSha = headRes.status === 0 ? String(headRes.stdout ?? '').trim() : '';

  const result = await runPilotReleaseGuards({
    allowPilotMigrations: process.env.ALLOW_PILOT_MIGRATIONS === 'true',
    expectedBaseSha: process.env.PILOT_EXPECTED_BASE_SHA ?? '',
    targetSha: process.env.GITHUB_SHA ?? '',
    headSha,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
    wranglerPilotTomlPath: resolve(cwd, 'wrangler.pilot.toml'),
    migrationsDir: resolve(cwd, 'migrations'),
    cwd,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.stderr.write(`❌ PILOT RELEASE GUARD FAILED [${result.code}]: ${result.detail}\n`);
    process.exit(1);
  }

  if (process.env.GITHUB_OUTPUT && result.prodVersionBefore) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `prod_version_before=${result.prodVersionBefore}\nlive_base_sha=${result.liveCommitSha}\n`,
    );
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    process.stderr.write(
      `❌ PILOT RELEASE GUARD UNHANDLED ERROR: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
