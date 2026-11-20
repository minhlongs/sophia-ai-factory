// @vitest-environment node
import { expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(__dirname, '..', 'check-diff-coverage.mjs');

function record(path: string, lines: number[], branches: number[] = []): string {
  return [
    `SF:${path}`,
    ...lines.map((hits, index) => `DA:${index + 1},${hits}`),
    ...branches.map((hits, index) => `BRDA:${index + 1},0,0,${hits || '-'}`),
    'end_of_record',
  ].join('\n');
}

function check(lcov: string, paths: string[], committed = false) {
  const cwd = mkdtempSync(join(tmpdir(), 'check-diff-coverage-'));
  function git(...args: string[]) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  function commit() {
    git('-c', 'user.name=Local Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Fixture', '--allow-empty');
  }
  try {
    git('init', '-q');
    commit();
    const base = git('rev-parse', 'HEAD');
    mkdirSync(join(cwd, 'src'));
    mkdirSync(join(cwd, 'coverage'));
    paths.forEach((path) => {
      mkdirSync(join(cwd, path, '..'), { recursive: true });
      writeFileSync(join(cwd, path),
      Array.from({ length: 10 }, (_, index) => `export const value${index} = ${index};`).join('\n'));
    });
    writeFileSync(join(cwd, 'coverage/lcov.info'), lcov);
    if (committed) {
      git('add', 'src');
      commit();
    }
    return spawnSync(process.execPath, [script], {
      cwd,
      env: { ...process.env, BASE_SHA: committed ? base : '' },
      encoding: 'utf8',
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const source = 'src/pilot.ts';
const covered = Array<number>(10).fill(1);
const atThreshold = [1, 1, 1, 1, 1, 1, 1, 0, 0, 0];

it.each([false, true])('rejects missing records (committed: %s)', (committed) => {
  const missing = 'src/missing file.ts';
  const result = check(record(source, covered), [source, missing], committed);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Missing LCOV records (1): ${missing}`);
});

it('counts and rejects wholly uncovered changed lines', () => {
  const other = 'src/other.ts';
  const result = check([record(source, covered), record(other, [0])].join('\n'), [source, other]);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('Changed executable lines: 10/11');
  expect(result.stderr).toContain(`${other} (lines)`);
});

it('counts and rejects wholly uncovered changed branches', () => {
  const other = 'src/other.ts';
  const result = check([record(source, covered, covered), record(other, [1], [0])].join('\n'), [source, other]);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('Changed branches: 10/11');
  expect(result.stderr).toContain(`${other} (branches)`);
});

it('passes at 70% for both measures', () => {
  const result = check(record(source, atThreshold, atThreshold), [source]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('7/10 (70.00%)');
});

it.each(['lines', 'branches'])('rejects aggregate %s below 70%', (measure) => {
  const below = [...atThreshold];
  below[0] = 0;
  const result = check(record(source, measure === 'lines' ? below : covered,
    measure === 'branches' ? below : covered), [source]);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('6/10 (60.00%)');
});

// Git quotes these names in ordinary patch headers and non-NUL filename lists.
it.each([false, true])('checks unusual filenames (committed: %s)', (committed) => {
  for (const path of ['src/tiếng-việt.ts', 'src/tab\tname.ts', 'src/new\nname.ts']) {
    const missing = check(record(source, covered), [source, path], committed);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain(`Missing LCOV records (1): ${path}`);
    // LCOV is line-delimited, so a newline filename cannot have an SF record.
    if (!path.includes('\n')) {
      expect(check(record(path, covered), [path], committed).status).toBe(0);
    }
  }
});

it('preserves nested src components in LCOV paths', () => {
  const nested = 'src/modules/src/nested.ts';
  expect(check(record(nested, covered), [nested]).status).toBe(0);
});

it('does not map an external absolute src suffix into the app', () => {
  const result = check(record('/external/project/src/pilot.ts', covered), [source]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Missing LCOV records (1): ${source}`);
});

it('merges repeated line and branch identities without inflating totals', () => {
  const result = check([
    record(source, atThreshold, atThreshold),
    record(source, [0], [0]),
    record(source, [1], [1]),
  ].join('\n'), [source]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Changed executable lines: 7/10 (70.00%)');
  expect(result.stdout).toContain('Changed branches: 7/10 (70.00%)');
});

it('keeps distinct branch identities at the same line', () => {
  const result = check([
    record(source, covered, covered),
    `SF:${source}\nBRDA:1,1,0,0\nBRDA:1,0,1,0\nend_of_record`,
  ].join('\n'), [source]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Changed branches: 10/12 (83.33%)');
});
