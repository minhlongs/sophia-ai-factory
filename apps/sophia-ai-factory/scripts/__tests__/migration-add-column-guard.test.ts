import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', '..');
const SCRIPT = join(APP_DIR, 'scripts', 'apply-migrations.sh');
const QUOTE = String.fromCharCode(39);

function shellQuote(value: string): string {
  return QUOTE + value.replace(new RegExp(QUOTE, 'g'), QUOTE + '\\' + QUOTE + QUOTE) + QUOTE;
}

const EXTRACT_PROGRAM = [
  '/^guard_add_column\\(\\) \\{/,/^\\}$/',
  '/^fold_sql_statements\\(\\) \\{/,/^\\}$/',
  '',
].join('\n');

function guardStatus(
  sql: string,
  existingColumns: string[],
  schemaQueryFails = false,
): number {
  const dir = mkdtempSync(join(tmpdir(), 'add-column-guard-'));
  try {
    const sqlFile = join(dir, 'probe.sql');
    const awkFile = join(dir, 'extract.awk');
    writeFileSync(sqlFile, sql);
    writeFileSync(awkFile, EXTRACT_PROGRAM);

    const cases = existingColumns
      .map((column) => `*"name='${column}'"*) echo 1 ;;`)
      .join('\n');
    const queryStub = schemaQueryFails
      ? ['d1_query_scalar() {', '  return 1', '}']
      : [
          'd1_query_scalar() {',
          '  case "$1" in',
          cases,
          '    *) echo 0 ;;',
          '  esac',
          '}',
        ];
    const program = [
      `eval "$(awk -f ${shellQuote(awkFile)} ${shellQuote(SCRIPT)})"`,
      ...queryStub,
      `guard_add_column ${shellQuote(sqlFile)} >/dev/null 2>&1`,
      'exit $?',
    ].join('\n');

    return spawnSync('bash', ['-c', program], { encoding: 'utf8' }).status ?? 99;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readMigration(filename: string): string {
  return execFileSync('cat', [join(APP_DIR, 'migrations', filename)], { encoding: 'utf8' });
}

describe('guard_add_column', () => {
  it('allows a single-line ADD COLUMN when the column is missing', () => {
    expect(guardStatus('ALTER TABLE users ADD COLUMN nickname TEXT;', [])).toBe(0);
  });

  it('allows a wrapped ADD COLUMN when the column is missing', () => {
    const sql = ['ALTER TABLE account_deletion_requests', 'ADD COLUMN confirmation_token_hash TEXT;'].join('\n');
    expect(guardStatus(sql, [])).toBe(0);
  });

  it('skips a pure ADD COLUMN file only when every target already exists', () => {
    const sql = [
      'ALTER TABLE users ADD COLUMN nickname TEXT;',
      'ALTER TABLE users ADD COLUMN timezone TEXT;',
    ].join('\n');
    expect(guardStatus(sql, ['nickname', 'timezone'])).toBe(1);
  });

  it('fails loudly instead of skipping a partially applied multi-column migration', () => {
    const sql = [
      'ALTER TABLE users ADD COLUMN nickname TEXT;',
      'ALTER TABLE users ADD COLUMN timezone TEXT;',
    ].join('\n');
    expect(guardStatus(sql, ['nickname'])).toBe(2);
  });

  it('fails loudly when an existing ADD COLUMN is mixed with pending SQL', () => {
    const sql = [
      'ALTER TABLE users ADD COLUMN nickname TEXT;',
      'CREATE INDEX idx_users_nickname ON users(nickname);',
    ].join('\n');
    expect(guardStatus(sql, ['nickname'])).toBe(2);
  });

  it('recognizes the wrapped production migration format', () => {
    expect(guardStatus(readMigration('0104-account-deletion-token-hash-column.sql'), [])).toBe(0);
  });

  it('ignores transaction control when every production ADD COLUMN already exists', () => {
    expect(
      guardStatus(readMigration('0186_add_diff_fields.sql'), [
        'diff_summary',
        'files_changed',
      ]),
    ).toBe(1);
  });

  it('fails loudly when the D1 schema query fails', () => {
    expect(guardStatus('ALTER TABLE users ADD COLUMN nickname TEXT;', [], true)).not.toBe(0);
  });
});
