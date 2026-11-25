#!/usr/bin/env node
/**
 * Operator CLI for the isolated `sophia-pilot-db` Support & Data Deletion queue.
 *
 * Schema matches `migrations/0519_pilot_support_requests.sql`:
 *   id, org_id, user_id, request_type ('support'|'data_deletion'),
 *   subject, message, status ('open'|'acknowledged'|'completed'),
 *   operator_note, created_at_iso, updated_at_iso, resolved_at_iso
 *
 * Commands:
 *   node scripts/pilot-support-queue.mjs list [--status=open|acknowledged|completed]
 *   node scripts/pilot-support-queue.mjs ack <psr_id> [note]
 *   node scripts/pilot-support-queue.mjs complete <psr_id> [note]
 *   node scripts/pilot-support-queue.mjs resolve <psr_id> [note]   # alias for complete
 *   node scripts/pilot-support-queue.mjs purge-user <psr_id> --confirm-delete
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_DB_NAME = 'sophia-pilot-db';
const PILOT_WRANGLER_CONFIG = 'wrangler.pilot.toml';
const REQUEST_ID_RE = /^psr_[a-z0-9-]{8,64}$/i;
const ALLOWED_STATUSES = new Set(['open', 'acknowledged', 'completed']);

export function validateSupportRequestId(raw) {
  const id = String(raw ?? '').trim();
  if (!REQUEST_ID_RE.test(id)) {
    throw new Error(`Invalid support request ID "${id}" (expected psr_<uuid>).`);
  }
  return id;
}

export function sqlEscapeLiteral(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 500);
  return `'${cleaned.replace(/'/g, "''")}'`;
}

export function buildPurgeUserStatements(userId, orgId, requestId, nowIso) {
  const safeUser = sqlEscapeLiteral(userId);
  const safeOrg = sqlEscapeLiteral(orgId);
  const safeReq = sqlEscapeLiteral(validateSupportRequestId(requestId));
  const safeNow = sqlEscapeLiteral(nowIso);
  return [
    `DELETE FROM "verification" WHERE identifier IN (SELECT email FROM "user" WHERE id = ${safeUser});`,
    `DELETE FROM user_api_keys WHERE user_id = ${safeUser};`,
    `DELETE FROM pilot_manual_publishes WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_mp4_exports WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_affiliate_clicks WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_affiliate_links WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM workspace_external_commissions WHERE tenant_id = ${safeOrg};`,
    `DELETE FROM pilot_affiliate_performance_entries WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_affiliate_campaigns WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_affiliate_offers WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM first_value_reviews WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_feedback WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_events WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_usage_quotas WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM pilot_consents WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM user_profiles WHERE user_id = ${safeUser};`,
    `DELETE FROM subscriptions WHERE org_id = ${safeOrg};`,
    `DELETE FROM org_balances WHERE org_id = ${safeOrg};`,
    `DELETE FROM org_members WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `DELETE FROM organizations WHERE id = ${safeOrg} AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = organizations.id);`,
    `DELETE FROM "session" WHERE userId = ${safeUser};`,
    `DELETE FROM "account" WHERE userId = ${safeUser};`,
    `DELETE FROM "user" WHERE id = ${safeUser};`,
    `DELETE FROM users WHERE id = ${safeUser};`,
    `UPDATE pilot_support_requests SET subject = '[purged]', message = '[purged]', updated_at_iso = ${safeNow} WHERE org_id = ${safeOrg} OR user_id = ${safeUser};`,
    `UPDATE pilot_support_requests SET status = 'completed', updated_at_iso = ${safeNow}, resolved_at_iso = ${safeNow}, operator_note = 'Customer pilot workspace data and PII purged' WHERE id = ${safeReq};`,
  ].join(' ');
}

function runPilotD1Sql(sql) {
  const env = { ...process.env };
  if (!env.CLOUDFLARE_WORKER_API_TOKEN) {
    env.CLOUDFLARE_API_TOKEN = '';
  } else {
    env.CLOUDFLARE_API_TOKEN = env.CLOUDFLARE_WORKER_API_TOKEN;
  }
  const stdout = execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      PILOT_DB_NAME,
      '--remote',
      '--config',
      PILOT_WRANGLER_CONFIG,
      '--json',
      '--command',
      sql,
    ],
    { cwd: APP_ROOT, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return Array.isArray(first?.results) ? first.results : [];
}

function main(argv) {
  const [subcommand = 'list', ...rest] = argv;

  if (subcommand === 'feedback') {
    const rows = runPilotD1Sql(
      `SELECT f.id, f.org_id, f.user_id, u.email AS user_email, f.artifact_id, f.rating, f.category, f.comment, f.created_at_iso FROM pilot_feedback f LEFT JOIN "user" u ON u.id = f.user_id ORDER BY f.created_at_iso DESC LIMIT 50;`,
    );
    process.stdout.write(`${JSON.stringify({ count: rows.length, feedback: rows }, null, 2)}\n`);
    return;
  }

  if (subcommand === 'list') {
    const statusFlag = rest.find((arg) => arg.startsWith('--status='));
    const rawStatus = statusFlag ? statusFlag.split('=')[1] : null;
    const statusValue = rawStatus === 'resolved' ? 'completed' : rawStatus;
    if (statusValue && !ALLOWED_STATUSES.has(statusValue)) {
      throw new Error(`Invalid --status="${rawStatus}". Expected open|acknowledged|completed.`);
    }
    const whereClause = statusValue ? `WHERE r.status = ${sqlEscapeLiteral(statusValue)}` : '';
    const rows = runPilotD1Sql(
      `SELECT r.id, r.request_type, r.status, r.org_id, r.user_id, u.email AS user_email, r.subject, r.message, r.created_at_iso, r.updated_at_iso, r.resolved_at_iso, r.operator_note FROM pilot_support_requests r LEFT JOIN "user" u ON u.id = r.user_id ${whereClause} ORDER BY r.created_at_iso DESC LIMIT 50;`,
    );
    process.stdout.write(`${JSON.stringify({ count: rows.length, requests: rows }, null, 2)}\n`);
    return;
  }

  if (subcommand === 'ack' || subcommand === 'complete' || subcommand === 'resolve') {
    const requestId = validateSupportRequestId(rest[0]);
    const isAck = subcommand === 'ack';
    const note =
      rest.slice(1).join(' ') || (isAck ? 'Acknowledged by operator' : 'Completed by operator');
    const nowIso = new Date().toISOString();
    const targetStatus = isAck ? 'acknowledged' : 'completed';
    const resolvedFragment = isAck ? '' : `, resolved_at_iso = ${sqlEscapeLiteral(nowIso)}`;
    runPilotD1Sql(
      `UPDATE pilot_support_requests SET status = ${sqlEscapeLiteral(targetStatus)}, updated_at_iso = ${sqlEscapeLiteral(nowIso)}${resolvedFragment}, operator_note = ${sqlEscapeLiteral(note)} WHERE id = ${sqlEscapeLiteral(requestId)};`,
    );
    const updated = runPilotD1Sql(
      `SELECT id, request_type, status, created_at_iso, updated_at_iso, resolved_at_iso, operator_note FROM pilot_support_requests WHERE id = ${sqlEscapeLiteral(requestId)};`,
    );
    process.stdout.write(`${JSON.stringify({ ok: true, updated: updated[0] ?? null }, null, 2)}\n`);
    return;
  }

  if (subcommand === 'purge-user') {
    const requestId = validateSupportRequestId(rest[0]);
    if (!rest.includes('--confirm-delete')) {
      throw new Error('Refusing purge without explicit --confirm-delete flag.');
    }
    const found = runPilotD1Sql(
      `SELECT id, request_type, user_id, org_id FROM pilot_support_requests WHERE id = ${sqlEscapeLiteral(requestId)} LIMIT 1;`,
    );
    const row = found[0];
    if (!row) {
      throw new Error(`Request ${requestId} not found in ${PILOT_DB_NAME}.`);
    }
    if (row.request_type !== 'data_deletion') {
      throw new Error(`Request ${requestId} has type "${row.request_type}", expected "data_deletion".`);
    }
    const nowIso = new Date().toISOString();
    runPilotD1Sql(buildPurgeUserStatements(row.user_id, row.org_id, requestId, nowIso));
    process.stdout.write(
      `${JSON.stringify({ ok: true, purgedOrgId: row.org_id, requestId, resolvedAtIso: nowIso }, null, 2)}\n`,
    );
    return;
  }

  throw new Error(`Unknown subcommand "${subcommand}". Expected list | ack | complete | resolve | purge-user.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[pilot-support-queue] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
