/**
 * Regression suite for `has_additive_ddl` in scripts/apply-migrations.sh.
 *
 * That helper answers one question: does this migration add schema shape (a new
 * column, table, or index)? When a migration ALSO carries a DROP/RENAME table
 * rebuild, `guard_drop_rename` compares the touched table names against
 * sqlite_master and treats the file as "already applied" when some are missing.
 * Answering "no additive DDL" for a file that actually adds a column is therefore
 * a silent schema loss: the file is recorded in the d1_migrations ledger while the
 * column never reaches production.
 *
 * That is exactly what happened on 2026-10-28. Migration 0480 rebuilt three tables
 * and also carried `ALTER TABLE "user" ADD COLUMN twoFactorEnabled`; because one
 * rebuild target was already absent the whole file was skipped, so every signup on
 * sophia.agencyos.network failed for days.
 *
 * The helper is bash. It is sourced out of the shipped script and called directly,
 * so these tests exercise the code that deploys rather than a copy of it, and they
 * stay hermetic — apply-migrations.sh has top-level side effects (a `cd` plus git
 * and D1 queries) that a plain `source` would trigger.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', '..');
const SCRIPT = join(APP_DIR, 'scripts', 'apply-migrations.sh');
const MIGRATIONS_DIR = join(APP_DIR, 'migrations');

const QUOTE = String.fromCharCode(39);
const DQUOTE = String.fromCharCode(34);

function shellQuote(value: string): string {
  return (
    QUOTE + value.replace(new RegExp(QUOTE, 'g'), QUOTE + '\\' + QUOTE + QUOTE) + QUOTE
  );
}

/**
 * The awk programs that lift each function out of apply-migrations.sh. They live
 * in a file rather than inline in a shell string so the escaping stays readable.
 */
const EXTRACT_PROGRAM = [
  '/^fold_sql_statements\\(\\) \\{/,/^\\}$/',
  '/^has_additive_ddl\\(\\) \\{/,/^\\}$/',
  '',
].join('\n');

/**
 * Returns true when `has_additive_ddl` reports additive DDL for the given SQL.
 *
 * The two function definitions are lifted out of apply-migrations.sh so the test
 * runs the shipped implementation. apply-migrations.sh itself is not sourced
 * whole, because it computes migrations and queries D1 at load time.
 */
function hasAdditiveDdl(sql: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'additive-ddl-'));
  try {
    const sqlFile = join(dir, 'probe.sql');
    const awkFile = join(dir, 'extract.awk');
    writeFileSync(sqlFile, sql);
    writeFileSync(awkFile, EXTRACT_PROGRAM);

    const program = [
      `eval "$(awk -f ${shellQuote(awkFile)} ${shellQuote(SCRIPT)})"`,
      `if has_additive_ddl ${shellQuote(sqlFile)}; then exit 0; fi`,
      'exit 1',
    ].join('\n');

    try {
      execFileSync('bash', ['-c', program], {
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readMigration(filename: string): string {
  return execFileSync('cat', [join(MIGRATIONS_DIR, filename)], { encoding: 'utf8' });
}

function classifyRealMigration(filename: string): boolean {
  return hasAdditiveDdl(readMigration(filename));
}

describe('has_additive_ddl', () => {
  describe('detects additive schema changes', () => {
    it('recognizes ALTER TABLE ADD COLUMN', () => {
      expect(hasAdditiveDdl('ALTER TABLE user ADD COLUMN nickname TEXT;')).toBe(true);
    });

    it('recognizes the quoted identifier form the incident migration used', () => {
      expect(hasAdditiveDdl(`ALTER TABLE ${DQUOTE}user${DQUOTE} ADD COLUMN nickname TEXT;`)).toBe(true);
    });

    it('recognizes CREATE TABLE', () => {
      expect(hasAdditiveDdl('CREATE TABLE IF NOT EXISTS passkey (id TEXT PRIMARY KEY);')).toBe(true);
    });

    it('recognizes CREATE INDEX', () => {
      expect(hasAdditiveDdl('CREATE INDEX IF NOT EXISTS idx_x ON things(x);')).toBe(true);
    });
  });

  describe('survives statement wrapping', () => {
    // Migration 0104 formats its ALTER across two lines. A per-line matcher sees
    // neither half and reports rebuild-only, which is the original bug class.
    it('sees ADD COLUMN when the statement is wrapped across lines', () => {
      const sql = ['ALTER TABLE account_deletion_requests', '  ADD COLUMN confirmation_token_hash TEXT;'].join('\n');
      expect(hasAdditiveDdl(sql)).toBe(true);
    });

    it('sees CREATE INDEX when ON <table> is on the following line', () => {
      const sql = [
        'CREATE INDEX IF NOT EXISTS idx_acct_del_token_hash',
        '  ON account_deletion_requests(confirmation_token_hash)',
        '  WHERE confirmation_token_hash IS NOT NULL;',
      ].join('\n');
      expect(hasAdditiveDdl(sql)).toBe(true);
    });

    it('flags migration 0480, which mixes a rebuild with the additive column', () => {
      expect(classifyRealMigration('0480_auth_2027_clean_slate.sql')).toBe(true);
    });
  });

  describe('is not fooled by text that is not a statement', () => {
    // Prose that merely names the clauses must not force a RUN.
    it('ignores ADD COLUMN that appears only inside a comment', () => {
      const sql = [
        '-- This migration rebuilds the widgets table.',
        '-- It does not run ALTER TABLE user ADD COLUMN anything.',
        'DROP TABLE widgets;',
        'CREATE TABLE widgets_new (id TEXT PRIMARY KEY);',
        'ALTER TABLE widgets_new RENAME TO widgets;',
      ].join('\n');
      expect(hasAdditiveDdl(sql)).toBe(false);
    });

    it('does not treat the rebuild staging table as a new object', () => {
      const sql = [
        'DROP TABLE campaigns;',
        'CREATE TABLE campaigns_new (id TEXT PRIMARY KEY, org_id TEXT);',
        'INSERT INTO campaigns_new (id, org_id) SELECT id, org_id FROM campaigns;',
        'ALTER TABLE campaigns_new RENAME TO campaigns;',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);',
      ].join('\n');
      expect(hasAdditiveDdl(sql)).toBe(false);
    });

    it('does not treat RENAME COLUMN as additive', () => {
      expect(hasAdditiveDdl('ALTER TABLE campaigns RENAME COLUMN old_name TO new_name;')).toBe(false);
    });

    it('does not treat DROP TABLE alone as additive', () => {
      expect(hasAdditiveDdl('DROP TABLE IF EXISTS legacy_thing;')).toBe(false);
    });
  });

  describe('respects single-quoted literals', () => {
    // A `;` or `--` inside a literal is data, not syntax.
    it('does not split a statement on a semicolon inside a string literal', () => {
      expect(hasAdditiveDdl(`ALTER TABLE settings ADD COLUMN note TEXT DEFAULT 'a;b -- c';`)).toBe(true);
    });

    it('does not treat -- inside a string literal as a comment start', () => {
      // Only an INSERT either side of the literal: the dashes must stay inside the
      // statement rather than truncating it at a comment boundary.
      const sql = [
        'DROP TABLE settings;',
        `INSERT INTO settings (label) VALUES ('keep this -- not a comment');`,
      ].join('\n');
      expect(hasAdditiveDdl(sql)).toBe(false);
    });
  });

  describe('agrees with the shipped migrations', () => {
    it('flags every migration that adds a column or table', () => {
      expect(classifyRealMigration('0483_better_auth_two_factor_user_column.sql')).toBe(true);
      expect(classifyRealMigration('0484_better_auth_passkey_and_two_factor_tables.sql')).toBe(true);
      expect(classifyRealMigration('0104-account-deletion-token-hash-column.sql')).toBe(true);
      expect(classifyRealMigration('0110-tenant-crypto-jurisdiction.sql')).toBe(true);
    });

    it('does not flag pure reshape migrations', () => {
      expect(classifyRealMigration('0088-org-members-drop-user-id-fk.sql')).toBe(false);
      expect(classifyRealMigration('0089-videos-drop-user-id-fk.sql')).toBe(false);
      expect(classifyRealMigration('0090-publisher-add-facebook-twitter.sql')).toBe(false);
      expect(classifyRealMigration('0210_relax_audit_logs_action_check.sql')).toBe(false);
    });
  });
});
