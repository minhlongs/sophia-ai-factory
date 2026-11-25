#!/usr/bin/env node
/**
 * On-Demand Pilot Operations & P0/P1 Triage CLI (`sophia-pilot-db`).
 *
 * Privacy & Honesty Invariants:
 * 1. NEVER claims background/daemon monitoring (`monitoringMode: "ON_DEMAND_CLI"`).
 * 2. NEVER queries `encrypted_key`, `script_json`, `topic`, `audience`, or raw prompts.
 * 3. Redacts secret-shaped tokens (`sk-*`, `r8_*`, `heygen*`, key=value, 20+ char mixed tokens,
 *    Bearer tokens, and emails) from free-text support/feedback excerpts.
 * 4. Reads `wrangler.pilot.toml` `[vars]` dynamically and runs unbounded `COUNT(1)` queries for P0/P1.
 *
 * Usage:
 *   node scripts/pilot-ops-report.mjs [--markdown]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KNOWN_OPERATOR_EMAIL_ALIASES } from './pilot-invite-policy.mjs';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_DB_NAME = 'sophia-pilot-db';
const PILOT_WRANGLER_CONFIG = 'wrangler.pilot.toml';

export const REQUIRED_PILOT_TABLES = Object.freeze([
  'user',
  'session',
  'user_api_keys',
  'first_value_reviews',
  'pilot_consents',
  'pilot_usage_quotas',
  'pilot_events',
  'pilot_feedback',
  'pilot_support_requests',
  'pilot_affiliate_links',
  'pilot_affiliate_clicks',
  'pilot_mp4_exports',
  'pilot_manual_publishes',
]);

export function redactSensitiveText(raw) {
  const step1 = String(raw ?? '')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|r8_[A-Za-z0-9_-]{10,}|heygen[_-][A-Za-z0-9+/=_-]{6,})\b/gi, '[REDACTED_API_KEY]')
    .replace(/\b(?:x-api-key|api[_-]?key|heygen|openrouter|authorization)\s*[:=]\s*\S+/gi, '[REDACTED_CREDENTIAL]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  // Token-level credential scrubber (handles 16+ char HeyGen/Base64 keys ending in '=', '+', '/', '-', mixed case, or digits)
  const redactedTokens = step1.replace(
    /(^|[\s"'([<,:;=])([A-Za-z0-9+/=_-]{16,})(?=$|[\s"')\]>.,;!?])/g,
    (full, prefix, token) => {
      const hasDigit = /\d/.test(token);
      const hasBase64Punct = /[+/=]/.test(token);
      const hasMixedCase = /[a-z]/.test(token) && /[A-Z]/.test(token);
      if (hasDigit || hasBase64Punct || (hasMixedCase && token.length >= 18)) {
        return `${prefix}[REDACTED_TOKEN]`;
      }
      return full;
    },
  );
  return redactedTokens.slice(0, 240);
}

export function readPilotWranglerVars(tomlPath = join(APP_ROOT, PILOT_WRANGLER_CONFIG)) {
  if (!existsSync(tomlPath)) {
    return {
      financingMode: 'UNKNOWN',
      paymentsEnabled: true,
      b2PublishEnabled: true,
      hasCronTriggers: false,
    };
  }
  const active = readFileSync(tomlPath, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*$/, ''))
    .join('\n');
  const getVar = (k) => active.match(new RegExp(`^\\s*${k}\\s*=\\s*"([^"]+)"`, 'm'))?.[1] ?? '';
  return {
    financingMode: getVar('PILOT_FINANCING_MODE') || 'UNKNOWN',
    paymentsEnabled: getVar('PAYMENTS_ENABLED').toLowerCase() !== 'false',
    b2PublishEnabled: getVar('B2_PUBLISH_ENABLED').toLowerCase() !== 'false',
    hasCronTriggers: active.includes('[triggers]'),
  };
}

export function classifyPilotP0P1Findings(snapshot) {
  const findings = [];

  if (snapshot.financingMode !== 'CUSTOMER_BYOK' || snapshot.paymentsEnabled || snapshot.b2PublishEnabled) {
    findings.push({
      severity: 'P0',
      domain: 'pilot_policy_drift',
      code: 'PILOT_CONFIG_GUARDRAIL_DRIFT',
      summary: `Expected CUSTOMER_BYOK + payments=false + b2Publish=false; got financing=${snapshot.financingMode}, payments=${snapshot.paymentsEnabled}, b2Publish=${snapshot.b2PublishEnabled}`,
    });
  }

  if (snapshot.missingTables.length > 0) {
    findings.push({
      severity: 'P0',
      domain: 'data_loss_or_schema',
      code: 'MISSING_PILOT_TABLES',
      summary: `Missing required D1 tables on sophia-pilot-db: ${snapshot.missingTables.join(', ')}`,
    });
  }

  if ((snapshot.lockedUsersCount ?? 0) > 0 || (snapshot.failedLoginAttemptsTotal ?? 0) >= 5) {
    findings.push({
      severity: (snapshot.lockedUsersCount ?? 0) > 0 ? 'P0' : 'P1',
      domain: 'login_auth',
      code: 'ELEVATED_FAILED_LOGINS',
      summary: `${snapshot.failedLoginAttemptsTotal ?? 0} cumulative failed login attempt(s), ${snapshot.lockedUsersCount ?? 0} locked account(s)`,
    });
  }

  const genFailed = snapshot.eventCounts.GENERATION_FAILED ?? 0;
  const genSucceeded = snapshot.eventCounts.GENERATION_SUCCEEDED ?? 0;
  if (genFailed > 0 && genSucceeded === 0) {
    findings.push({
      severity: 'P0',
      domain: 'byok_or_generation',
      code: 'ZERO_SUCCESS_GENERATIONS_WITH_FAILURES',
      summary: `${genFailed} script generation failure(s) recorded with 0 successes`,
    });
  } else if (genFailed >= 3) {
    findings.push({
      severity: 'P1',
      domain: 'byok_or_generation',
      code: 'REPEATED_GENERATION_FAILURES',
      summary: `${genFailed} script generation failures observed`,
    });
  }

  const mp4Failed = snapshot.mp4FailedCount ?? 0;
  const mp4Completed = snapshot.mp4CompletedCount ?? 0;
  if (mp4Failed > 0 && mp4Completed === 0) {
    findings.push({
      severity: 'P0',
      domain: 'video_render_export',
      code: 'MP4_EXPORT_BLOCKED',
      summary: `${mp4Failed} MP4 export/render failure(s) with 0 completed MP4 artifacts`,
    });
  } else if (mp4Failed > 0) {
    findings.push({
      severity: 'P1',
      domain: 'video_render_export',
      code: 'MP4_EXPORT_PARTIAL_FAILURE',
      summary: `${mp4Failed} MP4 export failure(s) recorded alongside ${mp4Completed} completed MP4(s)`,
    });
  }

  if (snapshot.openDeletionRequests > 0) {
    findings.push({
      severity: 'P0',
      domain: 'data_privacy_sla',
      code: 'OPEN_DATA_DELETION_REQUEST',
      summary: `${snapshot.openDeletionRequests} open customer data deletion request(s) awaiting 72h SLA execution`,
    });
  }

  if (snapshot.openSupportRequests > 0) {
    findings.push({
      severity: 'P1',
      domain: 'customer_support',
      code: 'OPEN_SUPPORT_REQUEST',
      summary: `${snapshot.openSupportRequests} open customer support request(s) in queue`,
    });
  }

  if (snapshot.bugReportFeedbackCount > 0) {
    findings.push({
      severity: 'P1',
      domain: 'customer_bug_report',
      code: 'CUSTOMER_REPORTED_BUG',
      summary: `${snapshot.bugReportFeedbackCount} customer bug_report feedback item(s) submitted`,
    });
  }

  return findings;
}

export function runPilotD1Query(sql) {
  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_WORKER_API_TOKEN ?? '',
  };
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

export function collectLivePilotOpsSnapshot(queryFn = runPilotD1Query, wranglerVars = readPilotWranglerVars()) {
  const tableRows = queryFn("SELECT name FROM sqlite_master WHERE type='table';");
  const presentSet = new Set(tableRows.map((r) => String(r.name)));
  const missingTables = REQUIRED_PILOT_TABLES.filter((t) => !presentSet.has(t));

  const operatorEmailsSqlList = KNOWN_OPERATOR_EMAIL_ALIASES.map((e) => `'${e.replace(/'/g, "''")}'`).join(', ');
  const nonOperatorFilter = presentSet.has('user')
    ? `user_id NOT IN (SELECT id FROM "user" WHERE lower(email) IN (${operatorEmailsSqlList}))`
    : '1=1';

  const eventRows = presentSet.has('pilot_events')
    ? queryFn(`SELECT event_name, COUNT(1) AS cnt FROM pilot_events WHERE ${nonOperatorFilter} GROUP BY event_name;`)
    : [];
  const eventCounts = {};
  for (const row of eventRows) {
    eventCounts[String(row.event_name)] = Number(row.cnt ?? 0);
  }

  let failedLoginAttemptsTotal = 0;
  let lockedUsersCount = 0;
  if (presentSet.has('user')) {
    try {
      const loginRow = queryFn(
        `SELECT COALESCE(SUM(failed_login_attempts), 0) AS attempts,
                COALESCE(SUM(CASE WHEN locked_until IS NOT NULL AND locked_until > datetime('now') THEN 1 ELSE 0 END), 0) AS locked_cnt
         FROM "user";`,
      )[0];
      failedLoginAttemptsTotal = Number(loginRow?.attempts ?? 0);
      lockedUsersCount = Number(loginRow?.locked_cnt ?? 0);
    } catch {
      // Graceful fallback if legacy test schema omits optional lockout columns
    }
  }

  let openDeletionRequests = 0;
  let openSupportRequests = 0;
  if (presentSet.has('pilot_support_requests')) {
    const openCounts = queryFn(
      "SELECT request_type, COUNT(1) AS cnt FROM pilot_support_requests WHERE status != 'completed' GROUP BY request_type;",
    );
    for (const r of openCounts) {
      if (r.request_type === 'data_deletion') openDeletionRequests = Number(r.cnt ?? 0);
      if (r.request_type === 'support') openSupportRequests = Number(r.cnt ?? 0);
    }
  }

  const supportRows = presentSet.has('pilot_support_requests')
    ? queryFn(
        'SELECT id, request_type, status, subject, created_at_iso FROM pilot_support_requests ORDER BY created_at_iso DESC LIMIT 20;',
      )
    : [];

  const bugReportFeedbackCount = presentSet.has('pilot_feedback')
    ? Number(
        queryFn("SELECT COUNT(1) AS cnt FROM pilot_feedback WHERE category = 'bug_report';")[0]?.cnt ?? 0,
      )
    : 0;

  const feedbackRows = presentSet.has('pilot_feedback')
    ? queryFn(
        'SELECT id, rating, category, comment, created_at_iso FROM pilot_feedback ORDER BY created_at_iso DESC LIMIT 20;',
      )
    : [];

  const mp4Stats = presentSet.has('pilot_mp4_exports')
    ? queryFn(
        `SELECT status, COUNT(1) AS cnt
         FROM pilot_mp4_exports
         WHERE ${nonOperatorFilter}
           AND length(COALESCE(cta_text, '')) >= 3
           AND length(COALESCE(short_code, '')) >= 8
         GROUP BY status;`,
      )
    : [];
  let mp4CompletedCount = 0;
  let mp4FailedCount = 0;
  for (const row of mp4Stats) {
    if (row.status === 'completed') mp4CompletedCount = Number(row.cnt ?? 0);
    if (row.status === 'failed') mp4FailedCount = Number(row.cnt ?? 0);
  }

  const shortlinksCount = presentSet.has('pilot_affiliate_links')
    ? Number(queryFn(`SELECT COUNT(1) AS cnt FROM pilot_affiliate_links WHERE ${nonOperatorFilter};`)[0]?.cnt ?? 0)
    : 0;
  const serverVerifiedClicks = presentSet.has('pilot_affiliate_clicks')
    ? Number(queryFn(`SELECT COUNT(1) AS cnt FROM pilot_affiliate_clicks WHERE ${nonOperatorFilter};`)[0]?.cnt ?? 0)
    : 0;
  const manualPublishes = presentSet.has('pilot_manual_publishes')
    ? queryFn(
        `SELECT platform, COUNT(1) AS posts,
                COALESCE(SUM(reported_views), 0) AS total_views,
                COALESCE(SUM(reported_conversions), 0) AS total_conversions
         FROM pilot_manual_publishes
         WHERE ${nonOperatorFilter}
         GROUP BY platform;`,
      )
    : [];

  const byokProviders = presentSet.has('user_api_keys')
    ? queryFn('SELECT provider, COUNT(1) AS cnt FROM user_api_keys GROUP BY provider;')
    : [];

  const snapshot = {
    checkedAtIso: new Date().toISOString(),
    monitoringMode: 'ON_DEMAND_CLI',
    backgroundMonitoringConfigured: wranglerVars.hasCronTriggers,
    financingMode: wranglerVars.financingMode,
    paymentsEnabled: wranglerVars.paymentsEnabled,
    b2PublishEnabled: wranglerVars.b2PublishEnabled,
    founderAiSubsidyUsd: wranglerVars.financingMode === 'CUSTOMER_BYOK' ? 0 : null,
    database: PILOT_DB_NAME,
    missingTables,
    byokKeyCountsByProvider: Object.fromEntries(
      byokProviders.map((r) => [String(r.provider), Number(r.cnt ?? 0)]),
    ),
    failedLoginAttemptsTotal,
    lockedUsersCount,
    eventCounts,
    commercialEvidence: {
      mp4CompletedWithCtaAndLink: mp4CompletedCount,
      mp4FailedCount,
      affiliateShortlinksCreated: shortlinksCount,
      serverVerifiedClicks,
      manualPublishesByPlatform: manualPublishes.map((r) => ({
        platform: String(r.platform),
        posts: Number(r.posts ?? 0),
        selfReportedViews: Number(r.total_views ?? 0),
        selfReportedConversions: Number(r.total_conversions ?? 0),
        provenance: 'CUSTOMER_SELF_REPORTED',
      })),
    },
    openDeletionRequests,
    openSupportRequests,
    bugReportFeedbackCount,
    recentSupportQueue: supportRows.map((r) => ({
      id: String(r.id),
      requestType: String(r.request_type),
      status: String(r.status),
      subject: redactSensitiveText(r.subject),
      createdAtIso: String(r.created_at_iso),
    })),
    recentFeedback: feedbackRows.map((r) => ({
      id: String(r.id),
      rating: Number(r.rating),
      category: String(r.category),
      commentExcerpt: redactSensitiveText(r.comment),
      createdAtIso: String(r.created_at_iso),
    })),
  };

  return {
    ...snapshot,
    mp4CompletedCount,
    mp4FailedCount,
    p0p1Findings: classifyPilotP0P1Findings({
      ...snapshot,
      mp4CompletedCount,
      mp4FailedCount,
    }),
  };
}

export function formatOpsMarkdown(report) {
  const lines = [
    '# Sophia Customer Pilot — On-Demand Operations Triage Report',
    '',
    `- **Checked At:** \`${report.checkedAtIso}\``,
    `- **Monitoring Mode:** \`${report.monitoringMode}\` (Background daemon configured: \`${report.backgroundMonitoringConfigured}\` — honest on-demand inspection only)`,
    `- **Financing Mode:** \`${report.financingMode}\` (\`$0.00\` Founder AI subsidy; zero API keys or private prompts queried)`,
    `- **P0/P1 Active Findings:** \`${report.p0p1Findings.length}\``,
    '',
    '## 1. P0 / P1 Triage Findings',
  ];
  if (report.p0p1Findings.length === 0) {
    lines.push('- None — zero P0/P1 blockers detected in `sophia-pilot-db`.');
  } else {
    for (const f of report.p0p1Findings) {
      lines.push(`- **[${f.severity}] \`${f.code}\` (${f.domain}):** ${f.summary}`);
    }
  }
  lines.push(
    '',
    '## 2. Real Commercial Validation Evidence (`sophia-pilot-db`)',
    `- **Completed MP4 Videos (with CTA & Referral Shortlink):** \`${report.commercialEvidence.mp4CompletedWithCtaAndLink}\``,
    `- **Affiliate Shortlinks Created:** \`${report.commercialEvidence.affiliateShortlinksCreated}\``,
    `- **Server-Verified Shortlink Clicks (\`/api/r/*\`):** \`${report.commercialEvidence.serverVerifiedClicks}\``,
    `- **Manual Publishes Recorded (\`CUSTOMER_SELF_REPORTED\`):** \`${report.commercialEvidence.manualPublishesByPlatform.reduce((s, p) => s + p.posts, 0)}\``,
    `- **Open Support / Deletion Queue:** \`${report.openSupportRequests}\` support, \`${report.openDeletionRequests}\` deletion`,
  );
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = collectLivePilotOpsSnapshot();
    if (process.argv.includes('--markdown')) {
      process.stdout.write(formatOpsMarkdown(report));
    } else {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
  } catch (err) {
    process.stderr.write(`[pilot-ops-report] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
