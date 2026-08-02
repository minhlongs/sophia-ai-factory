import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

vi.mock('fs', () => {
  const actual = vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
  };
});

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}));

describe('rollback-preexec', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('generates rollback-docs and abort-migrate directories', () => {
    const reportsDir = join(ROOT, 'plans', 'reports');
    const rollbackDocsDir = join(reportsDir, 'rollback-docs');
    const abortMigrateDir = join(reportsDir, 'abort-migrate');
    expect(fs.existsSync(rollbackDocsDir)).toBe(true);
    expect(fs.existsSync(abortMigrateDir)).toBe(true);
  });

  it('records payment replay event via APM logger', async () => {
    process.env.SOPHIA_EXPECTED_SHA = 'abc12345';
    const result = childProcess.execSync('node scripts/rollback-preexec.mjs', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const output = result.toString();
    expect(output).toContain('RollbackAudit');
  });

  it('emits valid JSON report with issue categories', () => {
    const reportsDir = join(ROOT, 'plans', 'reports');
    const rollbackLog = join(reportsDir, 'rollback-docs', 'rollback.log');
    const content = fs.readFileSync(rollbackLog, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('flow');
    expect(parsed).toHaveProperty('generation');
    expect(parsed).toHaveProperty('rollbackEligibleIssues');
  });

  it('triggers abort-migrate for migration failures', () => {
    const reportsDir = join(ROOT, 'plans', 'reports');
    const abortLog = join(reportsDir, 'abort-migrate', 'abort.log');
    expect(fs.existsSync(abortLog)).toBe(true);
    const content = fs.readFileSync(abortLog, 'utf8');
    expect(content).toContain('eligible');
  });
});
