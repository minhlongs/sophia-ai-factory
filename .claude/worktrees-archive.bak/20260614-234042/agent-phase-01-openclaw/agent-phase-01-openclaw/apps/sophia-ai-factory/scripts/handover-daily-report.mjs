#!/usr/bin/env node
/**
 * scripts/handover-daily-report.mjs
 *
 * Pulls aggregate stats + list of stuck/recent handovers from the admin API
 * and prints a Vietnamese ops summary. Optionally posts to a Telegram bot
 * when TELEGRAM_BOT_TOKEN + TELEGRAM_OPS_CHAT_ID are set.
 *
 * Usage:
 *   ADMIN_SESSION_COOKIE='__Secure-better-auth.session_token=…' \
 *     node scripts/handover-daily-report.mjs
 *
 * Get the cookie by logging into sophia.agencyos.network as admin and
 * copying the `__Secure-better-auth.session_token` cookie value from
 * DevTools → Application → Cookies.
 *
 * Env:
 *   ADMIN_SESSION_COOKIE — Better Auth session cookie header (full Cookie header)
 *   PROD_URL             — defaults to https://sophia.agencyos.network
 *   TELEGRAM_BOT_TOKEN   — optional; enables Telegram delivery
 *   TELEGRAM_OPS_CHAT_ID — optional; required when bot token set
 */

const PROD_URL = process.env.PROD_URL || 'https://sophia.agencyos.network';
const SESSION_COOKIE = process.env.ADMIN_SESSION_COOKIE;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_OPS_CHAT_ID;

if (!SESSION_COOKIE) {
  console.error('Missing ADMIN_SESSION_COOKIE env var.');
  console.error('Hint: copy `__Secure-better-auth.session_token=…` from browser DevTools.');
  process.exit(1);
}

const headers = { Cookie: SESSION_COOKIE };

async function fetchJson(path) {
  const res = await fetch(`${PROD_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

function fmtDate(unix) {
  if (!unix) return '—';
  return new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

function buildReport(stats, recent, stuck) {
  const lines = [];
  lines.push('# Sophia Handover — Daily Ops Report');
  lines.push(`Time (UTC): ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  lines.push('');
  lines.push('## Aggregate');
  lines.push(`- Total handovers       : ${stats.total}`);
  lines.push(`- Pending / Active      : ${stats.pending} / ${stats.active}`);
  lines.push(`- At risk / Churned     : ${stats.at_risk} / ${stats.churned}`);
  lines.push(`- Welcome email sent    : ${stats.email_sent}`);
  lines.push(`- First login / first run: ${stats.first_login} / ${stats.first_run}`);
  lines.push('');
  lines.push('## Drop-off');
  lines.push(`- Email sent, NEVER logged in: ${stats.stuck_no_login}`);
  lines.push(`- Logged in, NEVER ran      : ${stats.stuck_no_run}`);
  lines.push('');
  lines.push('## Last 10 handovers');
  for (const h of recent.slice(0, 10)) {
    lines.push(
      `- ${fmtDate(h.created_at)} | ${h.tier.padEnd(10)} | ${h.status.padEnd(8)} | ${h.email ?? '?'}`
    );
  }
  if (stuck.length > 0) {
    lines.push('');
    lines.push('## Stuck (email sent, no login >24h)');
    for (const h of stuck) {
      lines.push(`- ${h.email ?? '?'} | tier=${h.tier} | sent=${fmtDate(h.welcome_email_sent_at)}`);
    }
  }
  return lines.join('\n');
}

async function postTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return false;
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text: text.slice(0, 4000), // Telegram limit
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
  return res.ok;
}

(async () => {
  const [statsRes, listRes] = await Promise.all([
    fetchJson('/api/admin/handover/list?stats=1'),
    fetchJson('/api/admin/handover/list?limit=100'),
  ]);

  const stats = statsRes.stats;
  const recent = listRes.handovers ?? [];

  const dayAgo = Math.floor(Date.now() / 1000) - 24 * 3600;
  const stuck = recent.filter(
    (h) =>
      h.welcome_email_sent_at &&
      h.welcome_email_sent_at < dayAgo &&
      !h.customer_first_login_at,
  );

  const report = buildReport(stats, recent, stuck);
  console.log(report);

  const sent = await postTelegram(report);
  if (sent) console.error('\n[ok] Posted to Telegram.');
  else if (TG_TOKEN) console.error('\n[warn] Telegram post failed.');
})().catch((err) => {
  console.error('[handover-daily-report] FAILED:', err.message);
  process.exit(1);
});
