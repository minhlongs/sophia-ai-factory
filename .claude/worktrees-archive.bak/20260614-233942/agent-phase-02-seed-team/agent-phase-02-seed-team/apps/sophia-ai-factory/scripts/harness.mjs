#!/usr/bin/env node
/**
 * scripts/harness.mjs — Sophia AI Factory unified verification harness
 *
 * Wraps existing scripts as subprocesses, standardizes JSON evidence output.
 * Single file, no external dependencies, Node ESM.
 *
 * Usage:
 *   node scripts/harness.mjs pre-deploy    # 9 gates (default)
 *   node scripts/harness.mjs doctor        # 10-check health dashboard
 *   node scripts/harness.mjs post-deploy   # 8 HTTP/auth gates
 *   node scripts/harness.mjs load          # stub (k6 template)
 *   node scripts/harness.mjs pipeline      # pre + (optional deploy) + post
 *   node scripts/harness.mjs pipeline --skip-deploy
 *
 * Options:
 *   --skip-tests   skip vitest gate (pre-deploy)
 *   --skip-build   skip build gate (pre-deploy)
 *   --url URL      override prod URL (post-deploy)
 *   --json         machine-readable output (doctor)
 *
 * Exit codes: 0 = GREEN, 1 = RED, 2 = setup error
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, createReadStream } from 'node:fs';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

// ─── Constants ───────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const REPORTS_DIR = resolve(APP_DIR, 'plans/reports');
const PROD_URL = 'https://sophia.agencyos.network';
const VERSION = '1.0.0';

const FAIL_HINTS = {
  typecheck: 'npm run ci:typecheck',
  lint: 'npm run lint -- --fix',
  vitest: 'npm test -- --run',
  build: 'npm run build',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writeEvidence(phase, gates, overall, extra = {}) {
  ensureDir(REPORTS_DIR);
  const timestamp = ts();
  const commitSha = getCommitSha();
  const branch = getBranch();
  const payload = {
    harnessVersion: VERSION,
    phase,
    timestamp: new Date().toISOString(),
    project: 'sophia-ai-factory',
    appDir: 'apps/sophia-ai-factory',
    commitSha,
    branch,
    overall,
    gates,
    summary: summary(gates),
    failures: gates.filter((g) => g.status === 'failed').map((g) => ({
      gate: g.name,
      error: g.detail || g.error || 'unknown',
      hint: FAIL_HINTS[g.name] || null,
    })),
    ...extra,
  };

  const stamped = resolve(REPORTS_DIR, `harness-${phase}-${timestamp}.json`);
  const latest = resolve(REPORTS_DIR, `harness-${phase}-latest.json`);
  const json = JSON.stringify(payload, null, 2);

  writeFileSync(stamped, json);
  writeFileSync(latest, json);
  return { stamped, latest, payload };
}

function summary(gates) {
  const total = gates.length;
  const passed = gates.filter((g) => g.status === 'passed').length;
  const failed = gates.filter((g) => g.status === 'failed').length;
  const skipped = gates.filter((g) => g.status === 'skipped').length;
  const warnings = gates.filter((g) => g.status === 'warning').length;
  const durationMs = gates.reduce((s, g) => s + (g.durationMs || 0), 0);
  return { total, passed, failed, skipped, warnings, durationMs };
}

function overallStatus(sum) {
  if (sum.failed > 0) return 'RED';
  if (sum.warnings > 0) return 'YELLOW';
  return 'GREEN';
}

function getCommitSha() {
  try {
    return spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: APP_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
    }).stdout.trim().slice(0, 9);
  } catch {
    return 'unknown';
  }
}

function getBranch() {
  try {
    return spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: APP_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
    }).stdout.trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Run a command and return gate result.
 * @param {string} name
 * @param {string} command
 * @param {string[]} args
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=30000]
 * @param {object} [opts.env={}]
 * @param {boolean} [opts.shell=false]
 */
function runGate(name, command, args, opts = {}) {
  const { timeoutMs = 30000, env = {}, shell = false } = opts;
  const start = process.hrtime.bigint();
  const mergedEnv = { ...process.env, ...env };

  let result;
  try {
    result = spawnSync(command, args, {
      cwd: APP_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: timeoutMs,
      shell,
      env: mergedEnv,
    });
  } catch (err) {
    const dur = Number(process.hrtime.bigint() - start) / 1e6;
    return {
      name,
      status: 'failed',
      durationMs: Math.round(dur),
      detail: err.message,
      error: err.message,
      script: `${command} ${args.join(' ')}`,
    };
  }

  const dur = Number(process.hrtime.bigint() - start) / 1e6;
  const passed = result.status === 0;

  // Collect output for detail
  const stdout = (result.stdout || '').slice(-500);
  const stderr = (result.stderr || '').slice(-500);

  return {
    name,
    status: passed ? 'passed' : 'failed',
    durationMs: Math.round(dur),
    detail: passed
      ? stdout.trim() || `exit 0`
      : (stderr || stdout || `exit ${result.status ?? 'signal'}`).trim(),
    error: passed ? null : (stderr || `exit ${result.status}`).trim(),
    script: `${command} ${args.join(' ')}`,
  };
}

function runScriptGate(name, scriptPath, extraArgs = [], env = {}) {
  const absScript = resolve(APP_DIR, scriptPath);
  if (!existsSync(absScript)) {
    return {
      name,
      status: 'skipped',
      durationMs: 0,
      detail: `${scriptPath} not found — skipped`,
      script: scriptPath,
    };
  }
  const ext = basename(absScript);
  let command, args;
  if (ext.endsWith('.sh')) {
    command = 'bash';
    args = [absScript, ...extraArgs];
  } else if (ext.endsWith('.mjs') || ext.endsWith('.mts')) {
    command = 'node';
    args = [absScript, ...extraArgs];
  } else {
    command = 'node';
    args = [absScript, ...extraArgs];
  }
  return runGate(name, command, args, { env });
}

function hasNodeModules() {
  return existsSync(resolve(APP_DIR, 'node_modules/.bin/vitest'));
}

// ─── Summary Table ───────────────────────────────────────────────────────────

function printTable(gates, overall) {
  const icon = (s) =>
    s === 'passed' ? '✅ PASS' : s === 'failed' ? '❌ FAIL' : s === 'skipped' ? '⏭ SKIP' : '⚠️ WARN';
  const nameW = 24;
  const durW = 10;
  const totalW = nameW + durW + 10;

  console.log('');
  console.log('┌' + '─'.repeat(nameW) + '┬' + '─'.repeat(durW) + '┬' + '─'.repeat(10) + '┐');
  console.log(
    '│ ' + 'Gate'.padEnd(nameW - 1) + ' │ ' + 'Status'.padEnd(durW - 1) + ' │ ' + 'Duration'.padEnd(9) + ' │'
  );
  console.log('├' + '─'.repeat(nameW) + '┼' + '─'.repeat(durW) + '┼' + '─'.repeat(10) + '┤');

  for (const g of gates) {
    const dur = g.durationMs ? `${g.durationMs}ms` : '—';
    console.log(
      '│ ' + g.name.padEnd(nameW - 1) + ' │ ' + icon(g.status).padEnd(durW - 1) + ' │ ' + dur.padEnd(9) + ' │'
    );
  }

  console.log('├' + '─'.repeat(nameW) + '┼' + '─'.repeat(durW) + '┼' + '─'.repeat(10) + '┤');
  const color = overall === 'GREEN' ? '' : overall === 'YELLOW' ? '' : '';
  console.log(
    '│ ' + 'Overall'.padEnd(nameW - 1) + ' │ ' +
    (overall + ' ').padEnd(durW + 6) + ' │ ' + ' '.padEnd(9) + ' │'
  );
  console.log('└' + '─'.repeat(nameW) + '┴' + '─'.repeat(durW) + '┴' + '─'.repeat(10) + '┘');
}

function printFailures(gates) {
  const failures = gates.filter((g) => g.status === 'failed');
  if (failures.length === 0) return;
  console.log('\n── Failures ──────────────────────────────────────');
  for (const f of failures) {
    console.log(`  ${f.name}: ${f.detail || f.error || 'unknown'}`);
    if (f.hint) console.log(`  → ${f.hint}`);
  }
}

function exitWithReport(phase, gates) {
  const sum = summary(gates);
  const overall = overallStatus(sum);
  const { stamped, latest } = writeEvidence(phase, gates, overall);

  printTable(gates, overall);
  printFailures(gates);

  console.log(`\nEvidence: ${stamped}`);
  console.log(`Latest:   ${latest}`);

  if (overall === 'RED') process.exit(1);
  if (overall === 'YELLOW') process.exit(0); // warnings don't block
  process.exit(0); // GREEN
}

// ─── Phase: pre-deploy ───────────────────────────────────────────────────────

function phasePreDeploy(skipTests = false, skipBuild = false) {
  console.log('═'.repeat(50));
  console.log('  PHASE: pre-deploy');
  console.log('═'.repeat(50));
  console.log(`  App: ${APP_DIR}`);
  console.log(`  Branch: ${getBranch()}`);
  console.log('');

  const gates = [];
  const hasModules = hasNodeModules();

  // Gate 1: git preconditions
  gates.push(runGate('git-preconditions', 'bash', [
    '-c',
    'commits=$(git log origin/main..HEAD --oneline 2>/dev/null | grep -c . || true); if [ "$commits" -gt 0 ]; then echo "FAIL: $commits unpushed commits"; exit 1; fi; dirty=$(git diff-index --quiet HEAD -- 2>/dev/null; echo $?); if [ "$dirty" -ne 0 ]; then echo "FAIL: dirty working tree"; exit 1; fi; echo "PASS: HEAD == origin/main, clean tree"',
  ]));

  // Gate 2: typecheck
  gates.push(runGate('typecheck', 'npm', ['run', 'ci:typecheck'], { timeoutMs: 120000 }));

  // Gate 3: lint
  gates.push(runGate('lint', 'npm', ['run', 'lint'], { timeoutMs: 120000 }));

  // Gate 4: vitest
  if (!hasModules) {
    gates.push({
      name: 'vitest',
      status: 'skipped',
      durationMs: 0,
      detail: 'skipped — node_modules not installed',
      script: 'npm test -- --run',
    });
  } else if (skipTests) {
    gates.push({
      name: 'vitest',
      status: 'skipped',
      durationMs: 0,
      detail: 'skipped (--skip-tests)',
      script: 'npm test -- --run',
    });
  } else {
    gates.push(runGate('vitest', 'npm', ['test', '--', '--run'], { timeoutMs: 180000 }));
  }

  // Gate 5: build
  if (skipBuild) {
    gates.push({
      name: 'build',
      status: 'skipped',
      durationMs: 0,
      detail: 'skipped (--skip-build)',
      script: 'npm run build',
    });
  } else {
    gates.push(runGate('build', 'npm', ['run', 'build'], { timeoutMs: 300000 }));
  }

  // Gate 6: i18n validation
  gates.push(runGate('i18n-validate', 'npm', ['run', 'i18n:validate'], { timeoutMs: 60000 }));

  // Gate 7: GET side-effect check
  gates.push(runScriptGate('get-side-effects', 'scripts/ci-check-get-side-effects.sh', [], { timeoutMs: 30000 }));

  // Gate 8: migration coverage
  gates.push(runScriptGate('migration-coverage', 'scripts/check-migration-coverage.sh', [], { timeoutMs: 30000 }));

  // Gate 9: video factory proof
  gates.push(runGate('video-factory-proof', 'node', ['scripts/verify-core-video-factory.mjs'], {
    env: { SOPHIA_CORE_VIDEO_PROOF: '1', SOPHIA_VIDEO_PROVIDER: 'mock' },
    timeoutMs: 120000,
  }));

  exitWithReport('pre-deploy', gates);
}

// ─── Phase: doctor ───────────────────────────────────────────────────────────

function parseDoctorOutput(stdout) {
  const checks = [];
  const lines = stdout.split('\n');
  for (const line of lines) {
    // Match patterns like: ✅ Node v24.1.0  or  ❌ Node v20.0.0  or  ⚠️  Something
    const match = line.match(/^(✅|❌|⚠️)\s+(.+)/);
    if (match) {
      const status = match[1] === '✅' ? 'ok' : match[1] === '❌' ? 'fail' : 'warning';
      checks.push({ label: match[2].trim(), status });
    }
  }
  return checks;
}

function phaseDoctor(jsonOutput = false) {
  console.log('═'.repeat(50));
  console.log('  PHASE: doctor');
  console.log('═'.repeat(50));
  console.log(`  App: ${APP_DIR}`);
  console.log('');

  const scriptPath = resolve(APP_DIR, 'scripts/sophia-doctor.mjs');
  if (!existsSync(scriptPath)) {
    console.error('❌ sophia-doctor.mjs not found');
    process.exit(2);
  }

  const start = process.hrtime.bigint();
  const result = spawnSync('node', [scriptPath], {
    cwd: APP_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60000,
  });
  const dur = Number(process.hrtime.bigint() - start) / 1e6;

  // Print output
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);

  const checks = parseDoctorOutput(result.stdout || '');
  const passed = checks.filter((c) => c.status === 'ok').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const overall = failed > 0 ? 'RED' : warnings > 0 ? 'YELLOW' : 'GREEN';

  const gates = checks.map((c) => ({
    name: c.label.slice(0, 60),
    status: c.status === 'ok' ? 'passed' : c.status === 'warning' ? 'warning' : 'failed',
    durationMs: Math.round(dur / Math.max(checks.length, 1)),
    detail: c.label,
  }));

  const extra = { checks: checks.map((c) => ({ label: c.label, status: c.status })) };

  if (jsonOutput) {
    const { payload } = writeEvidence('doctor', gates, overall, extra);
    console.log('\n' + JSON.stringify(payload, null, 2));
  } else {
    const { stamped, latest } = writeEvidence('doctor', gates, overall, extra);
    printTable(gates, overall);
    console.log(`\nEvidence: ${stamped}`);
    console.log(`Latest:   ${latest}`);
  }

  // Doctor is informational — don't block
  if (overall === 'RED') {
    console.log('\n⚠️  Doctor found failures (informational — not blocking)');
  }
  process.exit(0);
}

// ─── Phase: post-deploy ──────────────────────────────────────────────────────

function phasePostDeploy(prodUrlOverride = null) {
  const prodUrl = (prodUrlOverride || PROD_URL).replace(/\/+$/, '');
  console.log('═'.repeat(50));
  console.log('  PHASE: post-deploy');
  console.log('═'.repeat(50));
  console.log(`  URL:  ${prodUrl}`);
  console.log(`  App:  ${APP_DIR}`);
  console.log('');

  const curlArgs = (url, expect = '200', method = null) => {
    const a = ['-fsS', '-o', '/dev/null', '-w', '%{http_code}', '-H', 'Accept: application/json', '-H', 'User-Agent: sophia-harness/1.0'];
    if (method) a.push('-X', method);
    a.push('--max-time', '15');
    a.push(url);
    return a;
  };

  const curlHeaderArgs = (url) => ['-sI', '-H', 'User-Agent: sophia-harness/1.0', '--max-time', '15', url];

  function checkHttp(name, url, expect) {
    const start = process.hrtime.bigint();
    const r = spawnSync('curl', curlArgs(url, expect), { encoding: 'utf8', stdio: 'pipe', timeout: 20000 });
    const dur = Number(process.hrtime.bigint() - start) / 1e6;
    const status = r.stdout?.trim();
    const ok = status === expect;
    return {
      name,
      status: ok ? 'passed' : 'failed',
      durationMs: Math.round(dur),
      detail: ok ? `HTTP ${status}` : `expected ${expect}, got ${status || 'no response'}`,
      error: ok ? null : `HTTP ${status || 'timeout'}`,
    };
  }

  function checkRedirect(url) {
    const start = process.hrtime.bigint();
    const r = spawnSync('curl', curlHeaderArgs(url), { encoding: 'utf8', stdio: 'pipe', timeout: 20000 });
    const dur = Number(process.hrtime.bigint() - start) / 1e6;
    const headers = r.stdout || '';
    const statusMatch = headers.match(/^HTTP\/\S+\s+(\d+)/m);
    const status = statusMatch ? statusMatch[1] : null;
    const is307 = status === '307' || status === '302';
    return {
      name: 'auth-redirect',
      status: is307 ? 'passed' : 'failed',
      durationMs: Math.round(dur),
      detail: is307 ? `HTTP ${status} redirect` : `expected 307/302, got ${status || 'no response'}`,
      error: is307 ? null : `HTTP ${status || 'timeout'}`,
    };
  }

  function checkApiVersion(url) {
    const start = process.hrtime.bigint();
    const r = spawnSync('curl', ['-fsS', '-H', 'Accept: application/json', '-H', 'User-Agent: sophia-harness/1.0', '--max-time', '15', `${url}/api/version`], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 20000,
    });
    const dur = Number(process.hrtime.bigint() - start) / 1e6;
    if (r.status !== 0) {
      return { name: 'api-version', status: 'failed', durationMs: Math.round(dur), detail: 'no response', error: r.stderr?.trim() || 'curl failed' };
    }
    try {
      const body = JSON.parse(r.stdout.trim());
      const hasSha = !!body.shortSha || !!body.commitSha;
      return {
        name: 'api-version',
        status: hasSha ? 'passed' : 'failed',
        durationMs: Math.round(dur),
        detail: hasSha ? `shortSha: ${body.shortSha || body.commitSha}` : 'missing shortSha in response',
        error: hasSha ? null : 'missing shortSha',
      };
    } catch {
      return { name: 'api-version', status: 'failed', durationMs: Math.round(dur), detail: 'invalid JSON', error: r.stdout.slice(0, 100) };
    }
  }

  function checkApiHealth(url) {
    const start = process.hrtime.bigint();
    const r = spawnSync('curl', curlArgs(`${url}/api/health`, '200'), { encoding: 'utf8', stdio: 'pipe', timeout: 20000 });
    const dur = Number(process.hrtime.bigint() - start) / 1e6;
    const status = r.stdout?.trim();
    // 200 or 401 are both acceptable (auth-protected health)
    if (status === '200' || status === '401') {
      return { name: 'api-health', status: 'passed', durationMs: Math.round(dur), detail: `HTTP ${status}`, error: null };
    }
    // 404 means endpoint not implemented — non-fatal
    if (status === '404') {
      return { name: 'api-health', status: 'warning', durationMs: Math.round(dur), detail: 'HTTP 404 — endpoint not implemented (non-fatal)', error: null };
    }
    return { name: 'api-health', status: 'failed', durationMs: Math.round(dur), detail: `HTTP ${status || 'no response'}`, error: `HTTP ${status}` };
  }

  const gates = [
    checkHttp('http-root', `${prodUrl}/`, '200'),
    checkHttp('http-login', `${prodUrl}/login`, '200'),
    checkHttp('http-pricing', `${prodUrl}/pricing`, '200'),
    checkHttp('http-blog', `${prodUrl}/blog`, '200'),
    checkHttp('http-guide', `${prodUrl}/guide`, '200'),
    checkRedirect(`${prodUrl}/dashboard`),
    checkApiVersion(prodUrl),
    checkApiHealth(prodUrl),
  ];

  exitWithReport('post-deploy', gates);
}

// ─── Phase: load ─────────────────────────────────────────────────────────────

function phaseLoad() {
  console.log('═'.repeat(50));
  console.log('  PHASE: load (stub)');
  console.log('═'.repeat(50));

  const loadDir = resolve(APP_DIR, 'tests/load');
  const loadFile = resolve(loadDir, 'harness-load.js');

  const k6Script = `// Sophia AI Factory — Load test stubs
// Run: k6 run tests/load/harness-load.js
//
// Scenarios:
//   1. Homepage — public landing page
//   2. Login page — auth entry point
//   3. Pricing page — public pricing
//   4. API version — lightweight health check

export const options = {
  scenarios: {
    homepage: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
    api_version: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Scenario: homepage
  const res = http.get('https://sophia.agencyos.network/');
  if (res.status !== 200) {
    console.error(\`homepage failed: \${res.status}\`);
  }
}

// TODO: Add more scenarios:
// - /login, /pricing, /blog, /guide (public pages)
// - /api/version (health check)
// - /api/health (if public)
// - POST /api/auth/signup (registration smoke test, requires test user)
// - Authenticated endpoints (requires token setup in k6 environment)
`;

  mkdirSync(loadDir, { recursive: true });
  writeFileSync(loadFile, k6Script);

  console.log(`\nLoad testing stubbed — k6 script template created at tests/load/harness-load.js`);
  console.log('Run with: k6 run tests/load/harness-load.js');

  // Write evidence
  const gates = [{
    name: 'k6-script-stub',
    status: 'passed',
    durationMs: 0,
    detail: `k6 script template created at tests/load/harness-load.js`,
    script: 'phaseLoad (stub)',
  }];

  const sum = summary(gates);
  const overall = overallStatus(sum);
  writeEvidence('load', gates, overall, { stub: true, note: 'Load testing stubbed — k6 script template created' });

  console.log(`\nEvidence: ${resolve(REPORTS_DIR, 'harness-load-latest.json')}`);
  process.exit(0);
}

// ─── Phase: pipeline ─────────────────────────────────────────────────────────

function phasePipeline(skipDeploy = false) {
  console.log('═'.repeat(50));
  console.log('  PHASE: pipeline (full)');
  console.log('═'.repeat(50));

  // Step 1: pre-deploy
  console.log('\n── Step 1/2: pre-deploy ──\n');
  phasePreDeploy(false, false);

  // Step 2: deploy (optional)
  if (!skipDeploy) {
    console.log('\n── Step 2/3: deploy ──\n');
    const deployScript = resolve(APP_DIR, 'scripts/deploy-with-sha.sh');
    if (!existsSync(deployScript)) {
      console.error('❌ deploy-with-sha.sh not found — deploy step skipped');
    } else {
      const r = spawnSync('bash', [deployScript], {
        cwd: APP_DIR,
        encoding: 'utf8',
        stdio: 'inherit',
        timeout: 600000,
      });
      if (r.status !== 0) {
        console.error('\n❌ DEPLOY FAILED — pipeline halted');
        process.exit(1);
      }
      console.log('\n✅ Deploy complete');
    }
  } else {
    console.log('\n── Step 2/3: deploy (skipped) ──\n');
  }

  // Step 3: post-deploy
  console.log('\n── Step 3/3: post-deploy ──\n');
  phasePostDeploy();
}

// ─── Arg Parsing ─────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const phase = args[0] || 'pre-deploy';
  const opts = {
    skipTests: args.includes('--skip-tests'),
    skipBuild: args.includes('--skip-build'),
    skipDeploy: args.includes('--skip-deploy'),
    json: args.includes('--json'),
    url: null,
  };

  // Extract --url value
  const urlIdx = args.indexOf('--url');
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    opts.url = args[urlIdx + 1];
  }

  return { phase, opts };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const { phase, opts } = parseArgs();

  const validPhases = ['pre-deploy', 'doctor', 'post-deploy', 'load', 'pipeline'];
  if (!validPhases.includes(phase)) {
    console.error(`Unknown phase: "${phase}"`);
    console.error(`Valid phases: ${validPhases.join(', ')}`);
    console.error(`Usage: node scripts/harness.mjs <phase> [--skip-tests] [--skip-build] [--skip-deploy] [--url URL] [--json]`);
    process.exit(2);
  }

  ensureDir(REPORTS_DIR);

  switch (phase) {
    case 'pre-deploy':
      phasePreDeploy(opts.skipTests, opts.skipBuild);
      break;
    case 'doctor':
      phaseDoctor(opts.json);
      break;
    case 'post-deploy':
      phasePostDeploy(opts.url);
      break;
    case 'load':
      phaseLoad();
      break;
    case 'pipeline':
      phasePipeline(opts.skipDeploy);
      break;
  }
}

main();
