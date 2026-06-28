#!/usr/bin/env node
/**
 * sophia-doctor.mjs — Single-command health check for Sophia AI Factory
 * Usage: node scripts/sophia-doctor.mjs  (or: npm run doctor)
 *
 * 10 checks, <10s target, exit 0=all green, 1=any ❌
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');

// ---------------------------------------------------------------------------
// Chalk (already in devDeps) — graceful fallback to plain text
// ---------------------------------------------------------------------------
let chalk;
try {
  chalk = (await import('chalk')).default;
} catch {
  chalk = {
    green: (s) => s, red: (s) => s, yellow: (s) => s,
    cyan: (s) => s, bold: (s) => s, gray: (s) => s,
  };
}

const PROD_URL = 'https://sophia.agencyos.network';

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
const results = []; // { label, status: 'ok'|'warn'|'fail', detail }

function ok(label, detail = '') {
  results.push({ label, status: 'ok', detail });
}
function warn(label, detail = '') {
  results.push({ label, status: 'warn', detail });
}
function fail(label, detail = '') {
  results.push({ label, status: 'fail', detail });
}

function icon(status) {
  if (status === 'ok') return chalk.green('✅');
  if (status === 'warn') return chalk.yellow('⚠️ ');
  return chalk.red('❌');
}

// ---------------------------------------------------------------------------
// 1. Node version
// ---------------------------------------------------------------------------
function checkNode() {
  const raw = process.version; // e.g. "v24.1.0"
  const [major, minor] = raw.slice(1).split('.').map(Number);
  const pass = major >= 24 || (major === 22 && minor >= 14);
  if (pass) ok(`Node ${raw}`);
  else fail(`Node ${raw}`, `need >=24 or >=22.14 — upgrade via nvm`);
}

// ---------------------------------------------------------------------------
// 2. Required env vars
// ---------------------------------------------------------------------------
const REQUIRED_VARS = [
  'BETTER_AUTH_SECRET',
  'NOWPAYMENTS_API_KEY',
  'OPENROUTER_API_KEY',
  'SENTRY_AUTH_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'TELEGRAM_BOT_TOKEN',
  'ADMIN_TELEGRAM_CHAT_ID',
  'BETTER_STACK_HEARTBEAT_URL',
  'BETTER_STACK_LOGS_TOKEN',
];
// Tier-conditional (checked if defined separately, warn only)
const OPTIONAL_TIER_VARS = ['ELEVENLABS_API_KEY', 'D_ID_API_KEY'];

function loadEnvLocal() {
  const envPath = resolve(ROOT, '.env.local');
  const devVars = resolve(ROOT, '.dev.vars');
  const env = {};
  for (const p of [envPath, devVars]) {
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

function checkEnvVars() {
  const env = { ...process.env, ...loadEnvLocal() };
  // Also check DATABASE_URL as alternative to D1 binding
  const hasDb = env['DATABASE_URL'] || env['DB']; // DB is wrangler binding name
  const missing = REQUIRED_VARS.filter((v) => !env[v]);
  const optMissing = OPTIONAL_TIER_VARS.filter((v) => !env[v]);

  const total = REQUIRED_VARS.length + (hasDb ? 0 : 1);
  const presentCount = REQUIRED_VARS.length - missing.length + (hasDb ? 1 : 0);

  if (missing.length === 0) {
    ok(`Env vars (${presentCount}/${REQUIRED_VARS.length} required${optMissing.length ? ` + ${optMissing.length} optional absent` : ''})`);
  } else {
    fail(
      `Env vars (${presentCount}/${REQUIRED_VARS.length} required)`,
      `missing: ${missing.join(', ')} — add to .env.local or .dev.vars`
    );
  }
  if (!hasDb) {
    warn('DATABASE_URL / D1 binding', 'neither DATABASE_URL nor wrangler D1 binding detected locally — ensure wrangler.toml DB binding is present');
  }
}

// ---------------------------------------------------------------------------
// 3. wrangler.toml bindings
// ---------------------------------------------------------------------------
const REQUIRED_BINDINGS = ['DB', 'NEXT_INC_CACHE_R2_BUCKET', 'VIDEO_BUCKET', 'ASSETS'];

function checkWranglerBindings() {
  const tomlPath = resolve(ROOT, 'wrangler.toml');
  if (!existsSync(tomlPath)) {
    fail('wrangler.toml bindings', 'wrangler.toml not found');
    return;
  }
  const content = readFileSync(tomlPath, 'utf8');
  const missing = REQUIRED_BINDINGS.filter((b) => !content.includes(`binding = "${b}"`));
  if (missing.length === 0) {
    ok(`wrangler.toml bindings (${REQUIRED_BINDINGS.join(', ')})`);
  } else {
    fail('wrangler.toml bindings', `missing: ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// 4. D1 migrations status
// ---------------------------------------------------------------------------
function checkMigrations() {
  const migrationsDir = resolve(ROOT, 'migrations');
  if (!existsSync(migrationsDir)) {
    warn('D1 migrations', 'migrations/ dir not found');
    return;
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  const count = files.length;

  // Try wrangler d1 migrations list — skip gracefully if not available
  try {
    const out = execSync(
      'npx wrangler d1 migrations list sophia-raas-db --local 2>&1',
      { cwd: ROOT, timeout: 6000, encoding: 'utf8', stdio: 'pipe' }
    );
    const appliedMatch = out.match(/Applied.*?(\d+)/i);
    const applied = appliedMatch ? parseInt(appliedMatch[1], 10) : null;
    if (applied !== null) {
      if (applied === count) ok(`D1 migrations: ${count} local = ${applied} applied`);
      else warn(`D1 migrations: ${count} local files, ${applied} applied`, 'run: npx wrangler d1 migrations apply sophia-raas-db --local');
    } else {
      warn(`D1 migrations: ${count} local files, applied=unknown (wrangler output unparsed)`, 'manual check: npx wrangler d1 migrations list sophia-raas-db');
    }
  } catch {
    warn(`D1 migrations: ${count} local files, applied=unknown (wrangler not available locally)`, 'manual check: npx wrangler d1 migrations list sophia-raas-db');
  }
}

// ---------------------------------------------------------------------------
// 5. TypeScript compile
// ---------------------------------------------------------------------------
function checkTypeScript() {
  try {
    execSync('npx tsc --noEmit 2>&1', {
      cwd: ROOT, timeout: 30000, encoding: 'utf8', stdio: 'pipe',
    });
    ok('TypeScript: 0 errors');
  } catch (e) {
    const output = e.stdout || e.stderr || String(e);
    const lines = output.split('\n').filter(Boolean);
    const errorCount = lines.filter((l) => l.includes(' error TS')).length;
    fail(`TypeScript: ${errorCount || '?'} error(s)`, lines.slice(0, 3).join(' | '));
  }
}

// ---------------------------------------------------------------------------
// 6. Production /api/version
// ---------------------------------------------------------------------------
async function checkProdVersion() {
  try {
    const res = await fetch(`${PROD_URL}/api/version`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { warn('Production /api/version', `HTTP ${res.status}`); return; }
    const json = await res.json();
    const { shortSha, deployedAt } = json;
    let age = '';
    if (deployedAt) {
      const ageMs = Date.now() - new Date(deployedAt).getTime();
      const ageH = Math.round(ageMs / 3600000);
      age = ageH < 24 ? ` (deployed ${ageH}h ago)` : ` (deployed ${Math.round(ageH / 24)}d ago)`;
    }
    ok(`Production /api/version: shortSha=${shortSha || 'unknown'}${age}`);
  } catch (e) {
    fail('Production /api/version', String(e));
  }
}

// ---------------------------------------------------------------------------
// 7. Production /api/health (HTTP status only)
// ---------------------------------------------------------------------------
async function checkProdHealth() {
  try {
    const res = await fetch(`${PROD_URL}/api/health`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'x-health-check': '1' },
    });
    if (res.status === 200 || res.status === 401) {
      ok(`Production /api/health: HTTP ${res.status}`);
    } else {
      fail(`Production /api/health: HTTP ${res.status}`, 'expected 200 or 401');
    }
  } catch (e) {
    fail('Production /api/health', String(e));
  }
}

// ---------------------------------------------------------------------------
// 8. MCP whitelist sanity
// ---------------------------------------------------------------------------
function checkMCPWhitelist() {
  const gatewayPath = resolve(ROOT, 'src/lib/openclaw/mcp-gateway.ts');
  if (!existsSync(gatewayPath)) {
    warn('MCP whitelist', 'src/lib/openclaw/mcp-gateway.ts not found');
    return;
  }
  const content = readFileSync(gatewayPath, 'utf8');
  const match = content.match(/new Set\(\[([^\]]+)\]\)/);
  if (!match) {
    warn('MCP whitelist', 'could not parse MCP_WHITELIST Set in mcp-gateway.ts');
    return;
  }
  const entries = match[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, '')) ?? [];

  // Check wrangler.toml for each entry
  const tomlPath = resolve(ROOT, 'wrangler.toml');
  const tomlContent = existsSync(tomlPath) ? readFileSync(tomlPath, 'utf8') : '';
  const missingInToml = entries.filter((e) => !tomlContent.includes(e));

  if (missingInToml.length === 0) {
    ok(`MCP whitelist: [${entries.join(', ')}] — all present in wrangler.toml`);
  } else {
    warn(
      `MCP whitelist: [${entries.join(', ')}]`,
      `not found in wrangler.toml: ${missingInToml.join(', ')} — add bindings if needed`
    );
  }
}

// ---------------------------------------------------------------------------
// 9. Better Stack heartbeat
// ---------------------------------------------------------------------------
async function checkBetterStack() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env['BETTER_STACK_HEARTBEAT_URL'];
  if (!url) {
    warn('Better Stack heartbeat', 'BETTER_STACK_HEARTBEAT_URL not set in .env.local');
    return;
  }
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (res.status === 200 || res.status === 202) {
      ok(`Better Stack heartbeat: HTTP ${res.status}`);
    } else {
      warn(`Better Stack heartbeat: HTTP ${res.status}`, 'expected 200 or 202');
    }
  } catch (e) {
    fail('Better Stack heartbeat', String(e));
  }
}

// ---------------------------------------------------------------------------
// 9b. CI/CD doctrine check
// ---------------------------------------------------------------------------
function checkCIDoctrine() {
  const disabledWorkflow = resolve(ROOT, '../..', '.github/workflows/test.yml.disabled');
  const activeWorkflow = resolve(ROOT, '../..', '.github/workflows/test.yml');
  if (existsSync(disabledWorkflow) && !existsSync(activeWorkflow)) {
    ok('CI: bypassed by design (CF-direct)', 'test.yml archived as .disabled — wrangler deploy is canonical');
  } else if (existsSync(activeWorkflow)) {
    warn('CI: test.yml is active', 'doctrine says CF-direct; if GH Actions still blocked, archive test.yml → test.yml.disabled');
  } else {
    warn('CI: workflow file not found', 'expected .github/workflows/test.yml.disabled for CF-direct doctrine');
  }
}

// ---------------------------------------------------------------------------
// 10. Git status
// ---------------------------------------------------------------------------
function checkGit() {
  try {
    const status = execSync('git status --porcelain 2>&1', {
      cwd: ROOT, encoding: 'utf8', timeout: 5000,
    }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>&1', {
      cwd: ROOT, encoding: 'utf8', timeout: 3000,
    }).trim();
    let aheadBehind = '';
    try {
      const ab = execSync('git rev-list --count --left-right @{upstream}...HEAD 2>&1', {
        cwd: ROOT, encoding: 'utf8', timeout: 3000,
      }).trim();
      const [behind, ahead] = ab.split('\t').map(Number);
      if (ahead > 0 || behind > 0) aheadBehind = ` (↑${ahead} ↓${behind})`;
    } catch { /* no upstream */ }

    if (!status) {
      ok(`Git: clean, branch=${branch}${aheadBehind}`);
    } else {
      const changed = status.split('\n').length;
      warn(`Git: ${changed} uncommitted change(s), branch=${branch}${aheadBehind}`, 'run: git status');
    }
  } catch (e) {
    warn('Git status', String(e));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  console.log(chalk.bold(`\n🩺 Sophia Doctor — ${now}\n`));

  // Sync checks
  checkNode();
  checkEnvVars();
  checkWranglerBindings();
  checkMigrations();
  checkTypeScript();
  checkMCPWhitelist();
  checkCIDoctrine();
  checkGit();

  // Async checks (parallel)
  await Promise.all([
    checkProdVersion(),
    checkProdHealth(),
    checkBetterStack(),
  ]);

  // Print results
  console.log('');
  for (const r of results) {
    const line = `${icon(r.status)}  ${r.label}`;
    if (r.detail) {
      console.log(line);
      console.log(`     ${chalk.gray(r.detail)}`);
    } else {
      console.log(line);
    }
  }

  const passed = results.filter((r) => r.status === 'ok').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log('');
  const summary = `Result: ${passed} ✅ / ${warned} ⚠️  / ${failed} ❌`;
  if (failed > 0) {
    console.log(chalk.red(chalk.bold(summary)));
  } else if (warned > 0) {
    console.log(chalk.yellow(chalk.bold(summary)));
  } else {
    console.log(chalk.green(chalk.bold(summary)));
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Doctor crashed:', e);
  process.exit(1);
});
