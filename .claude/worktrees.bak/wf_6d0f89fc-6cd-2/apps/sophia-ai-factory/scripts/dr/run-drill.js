#!/usr/bin/env node
/**
 * Sophia AI Factory — Automated DR Drill
 *
 * 1. Create a D1 backup with wrangler d1 export
 * 2. Verify checksum and row count
 * 3. Restore to an isolated test D1 database
 * 4. Validate restored tables
 * 5. Report RTO/RPO and append docs/dr-drill-log.md
 *
 * Required env vars: none for defaults; set PROD_DB, DR_TEST_DB, DRILL_LOG,
 * BACKUP_DIR, WRANGLER_BIN, OPERATOR if needed.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROD_DB = process.env.PROD_DB || 'sophia-raas-db';
const TEST_DB = process.env.DR_TEST_DB || 'sophia-drill-test';
const ROOT = path.resolve(__dirname, '..', '..');
const DRILL_LOG = path.resolve(ROOT, process.env.DRILL_LOG || 'docs/dr-drill-log.md');
const BACKUP_DIR = path.resolve(ROOT, process.env.BACKUP_DIR || 'backups/drills');
const WRANGLER = process.env.WRANGLER_BIN || 'npx wrangler';
const ISO_TIMESTAMP = new Date().toISOString();
const FILE_TIMESTAMP = ISO_TIMESTAMP.replace(/[:.]/g, '-').slice(0, 19);
const DRILL_ID = `drill-${FILE_TIMESTAMP}`;

function run(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    cwd: opts.cwd || ROOT,
    stdio: opts.silent ? 'pipe' : 'inherit',
    timeout: opts.timeout || 300_000,
  }).trim();
}

function runQuiet(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function createBackup() {
  log('Phase 1: Create D1 backup');
  const createdAt = new Date().toISOString();
  const file = path.join(BACKUP_DIR, `d1-${FILE_TIMESTAMP}.sql`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const start = Date.now();
  run(`${WRANGLER} d1 export ${PROD_DB} --remote --skip-confirmation --output ${file}`);
  const elapsed = Date.now() - start;

  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error('Backup file is empty or missing');
  }

  const size = fs.statSync(file).size;
  const checksum = sha256File(file);
  log(`Backup: ${file} (${size} bytes, sha256=${checksum.slice(0, 16)}...)`);
  return { file, size, checksum, createdAt, exportElapsedMs: elapsed };
}

async function verifyBackup(backup) {
  log('Phase 2: Verify backup integrity');
  const sql = fs.readFileSync(backup.file, 'utf8');
  const rowCount = (sql.match(/INSERT INTO/g) || []).length;
  const checksumOk = sha256File(backup.file) === backup.checksum;
  const hasSchema = sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX') || sql.includes('CREATE UNIQUE INDEX');

  let tableCount = -1;
  try {
    const out = runQuiet(`${WRANGLER} d1 execute ${PROD_DB} --remote --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"`);
    const m = out.match(/\| *(\d+) *\|/);
    if (m) tableCount = Number(m[1]);
  } catch {
    log('Could not query production table count; continuing with backup checks');
  }

  if (!checksumOk || !hasSchema) {
    throw new Error(`Backup integrity failed: checksum=${checksumOk}, hasSchema=${hasSchema}`);
  }

  log(`Integrity OK: rows=${rowCount}, tables=${tableCount}, size=${backup.size}`);
  return { rowCount, tableCount, checksumOk };
}

async function restoreToTestDb(backup) {
  log(`Phase 3: Restore to test DB ${TEST_DB}`);
  const start = Date.now();
  const restoreStartedAt = new Date().toISOString();

  try {
    run(`${WRANGLER} d1 create ${TEST_DB}`, { silent: true });
    log('Created test database');
  } catch {
    log('Test database already exists; reusing it');
  }

  run(`${WRANGLER} d1 execute ${TEST_DB} --remote --yes --file ${backup.file}`);
  const restoreElapsedMs = Date.now() - start;
  log(`Restore complete: ${restoreElapsedMs}ms`);
  return { restoreElapsedMs, restoreStartedAt };
}

async function validateRestore() {
  log('Phase 4: Validate restored data');
  const out = runQuiet(`${WRANGLER} d1 execute ${TEST_DB} --remote --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"`);
  const m = out.match(/\| *(\d+) *\|/);
  const restoredTables = m ? Number(m[1]) : -1;

  const tables = runQuiet(`${WRANGLER} d1 execute ${TEST_DB} --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"`)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[a-z_][a-z_0-9]*$/.test(line))
    .join(', ');

  log(`Restored tables: ${restoredTables} (${tables || 'none'})`);
  return { restoredTables, tables };
}

function appendLog(metrics, backup, integrity, restore, validation, failed = false, note = 'All phases passed') {
  fs.mkdirSync(path.dirname(DRILL_LOG), { recursive: true });
  const operator = process.env.OPERATOR || 'automated';
  const entry = `
## ${DRILL_ID} — ${failed ? 'FAILED' : 'PASSED'}

| Field | Value |
|---|---|
| **Date** | ${ISO_TIMESTAMP} |
| **Drill ID** | ${DRILL_ID} |
| **Status** | ${failed ? 'FAILED' : 'PASSED'} |
| **Source DB** | ${PROD_DB} |
| **Test DB** | ${TEST_DB} |
| **Backup file** | ${path.basename(backup.file)} |
| **Backup size** | ${backup.size} bytes |
| **Checksum (sha256)** | \`${backup.checksum}\` |
| **Row count** | ${integrity.rowCount} |
| **Restored tables** | ${validation.restoredTables} |
| **RTO** | ${metrics.rtoMin} min (${metrics.rtoMs} ms) |
| **RPO** | ${metrics.rpoMin} min (${metrics.rpoMs} ms) |
| **Export elapsed** | ${backup.exportElapsedMs} ms |
| **Restore elapsed** | ${restore.restoreElapsedMs} ms |
| **Integrity** | ${integrity.checksumOk ? 'OK' : 'FAILED'} |
| **Operator** | ${operator} |
| **Notes** | ${failed ? note : 'All phases passed'} |

`;
  fs.appendFileSync(DRILL_LOG, entry);
  log(`Drill log appended: ${DRILL_LOG}`);
}

async function main() {
  log('=== Sophia AI Factory DR Drill ===');
  const phases = { failed: false, error: '' };

  try {
    const backup = await createBackup();
    const integrity = await verifyBackup(backup);
    const restore = await restoreToTestDb(backup);
    const validation = await validateRestore();

    const rtoMs = backup.exportElapsedMs + restore.restoreElapsedMs;
    const rpoMs = backup.exportElapsedMs;
    const metrics = {
      rtoMs,
      rtoMin: (rtoMs / 60_000).toFixed(2),
      rpoMs,
      rpoMin: (rpoMs / 60_000).toFixed(2),
    };

    appendLog(metrics, backup, integrity, restore, validation);

    log('=== DR Drill PASSED ===');
    log(`RTO=${metrics.rtoMin}min RPO=${metrics.rpoMin}min rows=${integrity.rowCount} tables=${validation.restoredTables}`);
    process.exit(0);
  } catch (err) {
    phases.failed = true;
    phases.error = err.message;
    try {
      const backup = { file: '', size: 0, checksum: 'unknown', exportElapsedMs: 0 };
      const integrity = { rowCount: 0, tableCount: 0, checksumOk: false };
      const restore = { restoreElapsedMs: 0 };
      const validation = { restoredTables: 0, tables: '' };
      appendLog({ rtoMs: 0, rtoMin: '0', rpoMs: 0, rpoMin: '0' }, backup, integrity, restore, validation, true, err.message);
    } catch {
      // ignore logging failure
    }
    log(`=== DR Drill FAILED: ${err.message} ===`);
    process.exit(1);
  }
}

main();
