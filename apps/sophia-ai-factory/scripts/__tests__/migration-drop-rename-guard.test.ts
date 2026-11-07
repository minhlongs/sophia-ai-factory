/**
 * Regression suite for `extract_drop_rename_targets` in scripts/apply-migrations.sh.
 *
 * `guard_drop_rename` compares every pre-existing table a migration drops or
 * renames against sqlite_master, and treats a short count as "this file already
 * ran". For a pure table-rebuild migration that heuristic is only sound when the
 * staging table (`<tbl>_new`) that `RENAME TO` will eliminate at the end is not
 * itself counted. Counting it makes `count < expected` always true, so every
 * rebuild migration is skipped and never recorded in d1_migrations — which is how
 * `0496_rebuild_platform_configs_without_legacy_user_fk` and the three table
 * rebuilds inside `0480_auth_2027_clean_slate` were silently skipped in production
 * and left live FKs pointing at the retired `users` table.
 *
 * The helper is bash. It is lifted out of the shipped script so these tests
 * exercise the code that deploys rather than a copy of it, and they stay hermetic —
 * apply-migrations.sh has top-level side effects (a `cd` plus git and D1 queries)
 * that a plain `source` would trigger.
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

function shellQuote(value: string): string {
  return QUOTE + value.replace(new RegExp(QUOTE, 'g'), QUOTE + '\\' + QUOTE + QUOTE) + QUOTE;
}

/**
 * `extract_drop_rename_targets` depends on `fold_sql_statements`, which is also
 * lifted out of apply-migrations.sh so the statement splitter under test is the
 * shipped one. They live in a file rather than inline in a shell string so the
 * escaping stays readable.
 */
const EXTRACT_PROGRAM = [
  '/^fold_sql_statements\\(\\) \\{/,/^\\}$/',
  '/^extract_drop_rename_targets\\(\\) \\{/,/^\\}$/',
  '',
].join('\n');

/**
 * Returns the pre-existing tables a migration would check in sqlite_master.
 */
function dropRenameTargets(sql: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'drop-rename-'));
  try {
    const sqlFile = join(dir, 'probe.sql');
    const awkFile = join(dir, 'extract.awk');
    writeFileSync(sqlFile, sql);
    writeFileSync(awkFile, EXTRACT_PROGRAM);

    const program = [
      `eval "$(awk -f ${shellQuote(awkFile)} ${shellQuote(SCRIPT)})"`,
      `extract_drop_rename_targets ${shellQuote(sqlFile)} > ${shellQuote(join(dir, 'out.txt'))}`,
    ].join('\n');

    execFileSync('bash', ['-c', program], { encoding: 'utf8' });
    const out = execFileSync('cat', [join(dir, 'out.txt')], { encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readMigration(filename: string): string {
  return execFileSync('cat', [join(MIGRATIONS_DIR, filename)], { encoding: 'utf8' });
}

const REBUILD_SIX_TABLES = '0497_rebuild_six_tables_without_legacy_user_fk.sql';
const REBUILD_SIXTEEN_TABLES = '0498_rebuild_sixteen_tables_without_legacy_user_fk.sql';
const REBUILD_PLATFORM_CONFIGS = '0496_rebuild_platform_configs_without_legacy_user_fk.sql';

describe('extract_drop_rename_targets', () => {
  describe('excludes staging tables created in the same file', () => {
    // Counting `<tbl>_new` is the original defect: the staging table is gone
    // after its own RENAME, so `count < expected` is always true and the
    // migration is silently skipped.
    it('reports only the pre-existing table for a rebuild', () => {
      const sql = [
        'DROP TABLE widgets;',
        'CREATE TABLE widgets_new (id TEXT PRIMARY KEY);',
        'INSERT INTO widgets_new (id) SELECT id FROM widgets;',
        'ALTER TABLE widgets_new RENAME TO widgets;',
      ].join('\n');
      expect(dropRenameTargets(sql)).toEqual(['widgets']);
    });

    it('excludes the `DROP TABLE IF EXISTS <tbl>_new` idempotency cleanup', () => {
      const sql = [
        'DROP TABLE IF EXISTS gadgets_new;',
        'CREATE TABLE gadgets_new (id TEXT PRIMARY KEY);',
        'INSERT INTO gadgets_new (id) SELECT id FROM gadgets;',
        'DROP TABLE gadgets;',
        'ALTER TABLE gadgets_new RENAME TO gadgets;',
      ].join('\n');
      expect(dropRenameTargets(sql)).toEqual(['gadgets']);
    });

    it('does not count a staging table guarded by CREATE TABLE IF NOT EXISTS', () => {
      const sql = [
        'CREATE TABLE IF NOT EXISTS skus_new (id TEXT PRIMARY KEY);',
        'DROP TABLE skus;',
        'ALTER TABLE skus_new RENAME TO skus;',
      ].join('\n');
      expect(dropRenameTargets(sql)).toEqual(['skus']);
    });

    it('strips block comments before CREATE TABLE so staging tables stay transient', () => {
      const sql = [
        '/* rebuild invoices without legacy fk */ CREATE TABLE invoices_new (id TEXT PRIMARY KEY);',
        'DROP TABLE invoices;',
        'ALTER TABLE invoices_new RENAME TO invoices;',
      ].join('\n');
      expect(dropRenameTargets(sql)).toEqual(['invoices']);
    });
  });

  describe('returns one entry per pre-existing table', () => {
    it('deduplicates a table dropped and renamed in the same file', () => {
      const sql = [
        'DROP TABLE orders;',
        'CREATE TABLE orders_new (id TEXT PRIMARY KEY);',
        'ALTER TABLE orders_new RENAME TO orders;',
        'DROP TABLE orders_archive;',
        'CREATE TABLE orders_archive_new (id TEXT PRIMARY KEY);',
        'ALTER TABLE orders_archive_new RENAME TO orders_archive;',
      ].join('\n');
      expect(dropRenameTargets(sql)).toEqual(['orders', 'orders_archive']);
    });

    it('reports no targets for a migration with no destructive DDL', () => {
      expect(dropRenameTargets('ALTER TABLE user ADD COLUMN nickname TEXT;')).toEqual([]);
    });

    it('reports no targets when only `DROP TABLE IF EXISTS` is present', () => {
      expect(dropRenameTargets('DROP TABLE IF EXISTS stale_cache;')).toEqual([]);
    });
  });

  describe('agrees with the shipped migrations', () => {
    // The staging-table bug is what skipped these. Each one must look like a
    // pure rebuild of exactly the tables the file declares.
    it('lists the six tables rebuilt by the GH-120 migration', () => {
      expect(dropRenameTargets(readMigration(REBUILD_SIX_TABLES))).toEqual([
        'payouts',
        'user_wallets',
        'affiliate_clicks',
        'scheduled_campaigns',
        'video_analytics',
        'marketplace_templates',
      ]);
    });

    it('lists the sixteen tables rebuilt by the GH-121 migration', () => {
      expect(dropRenameTargets(readMigration(REBUILD_SIXTEEN_TABLES))).toEqual([
        'tier_change_events',
        'campaigns',
        'raas_licenses',
        'raas_audit_logs',
        'affiliate_offers_selected',
        'affiliate_conversions',
        'user_payout_settings',
        'repurpose_jobs',
        'thumbnail_variants',
        'whatsapp_templates',
        'whatsapp_message_log',
        'localized_payment_transactions',
        'financial_close_periods',
        'revenue_schedules',
        'intercompany_transfers',
        'ipo_filing_periods',
      ]);
    });

    it('reports a single-table rebuild for the platform_configs migration', () => {
      expect(dropRenameTargets(readMigration(REBUILD_PLATFORM_CONFIGS))).toEqual(['platform_configs']);
    });
  });
});
