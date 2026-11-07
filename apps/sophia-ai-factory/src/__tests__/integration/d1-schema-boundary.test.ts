/**
 * D1 schema boundary harness contract.
 *
 * The property under test: the harness's schema is the one the migrations
 * actually produce, and a query naming a table or column that no migration
 * defines fails here exactly as it fails against real D1.
 *
 * Boundary: SQLite/D1-compatible integration. These tests prove the schema
 * boundary is real. They do not prove Cloudflare-side D1 behaviour — account
 * limits, remote latency, or any construct SQLite accepts and D1 rejects.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSchemaDatabase,
  createSchemaBoundD1,
  findSchemaViolations,
  makeSchemaBoundD1,
} from './d1-schema-boundary';

describe('d1-schema-boundary harness', () => {
  describe('the schema is derived from the migrations, not written by hand', () => {
    it('applies the migration files and reports how many took effect', () => {
      const { report } = buildSchemaDatabase();
      expect(report.migrationFiles).toBeGreaterThan(400);
      // Every file must either apply or be reported as skipped. A count that
      // matches neither means the chain is being silently dropped.
      expect(report.migrationsApplied + report.skippedMigrations.length).toBe(report.migrationFiles);
      expect(report.tableCount).toBeGreaterThan(100);
    });

    it('reports the migrations it could not apply instead of hiding them', () => {
      const { report } = buildSchemaDatabase();
      // The full chain carries known-broken files. They must be visible, because
      // a schema built from a partial chain is a finding, not something to hide.
      for (const skipped of report.skippedMigrations) {
        expect(skipped.file).toMatch(/\.sql$/);
        expect(skipped.error.length).toBeGreaterThan(0);
      }
      expect(Array.isArray(report.skippedMigrations)).toBe(true);
    });

    it('honours the deliberate table retirement the migration chain performs', () => {
      const { db } = buildSchemaDatabase();
      // Migration 0439 migrates `users` to Better Auth's canonical `user`.
      const legacy = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
      const current = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user'").get();
      expect(legacy).toBeUndefined();
      expect(current).toBeDefined();
    });
  });

  describe('real production queries resolve against the derived schema', () => {
    const REAL_QUERIES: Array<[string, string]> = [
      [
        'BYOK provider list',
        'SELECT provider FROM user_api_keys WHERE user_id = ? ORDER BY provider ASC',
      ],
      [
        'BYOK upsert with a fallback column set',
        `INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_version, key_validated_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, provider) DO UPDATE SET
           encrypted_key = excluded.encrypted_key,
           key_version = excluded.key_version,
           key_validated_at = excluded.key_validated_at,
           updated_at = datetime('now')`,
      ],
      [
        'BYOK upsert without the optional column',
        `INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_version, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, provider) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = datetime('now')`,
      ],
      [
        'aggregate with a SELECT alias',
        'SELECT COUNT(*) AS cnt FROM user_api_keys WHERE user_id = ?',
      ],
      [
        'table alias through a join',
        // `account.userId` is Better Auth's column spelling, not `user_id`. A
        // harness that invents `user_id` here would accept a query production
        // would reject, so this case pins the derived spelling.
        'SELECT u.id, u.email FROM user u JOIN account a ON a.userId = u.id WHERE u.id = ?',
      ],
    ];

    for (const [name, sql] of REAL_QUERIES) {
      it(`accepts ${name}`, () => {
        const { db } = buildSchemaDatabase();
        expect(findSchemaViolations(db, sql)).toEqual([]);
      });
    }
  });

  describe('queries naming something the migrations never defined are rejected', () => {
    it('rejects an unknown table', () => {
      const { db } = buildSchemaDatabase();
      const violations = findSchemaViolations(db, 'SELECT * FROM table_that_no_migration_defines');
      expect(violations).toHaveLength(1);
      expect(violations[0].error).toMatch(/no such table/i);
    });

    it('rejects an unknown column on a real table', () => {
      const { db } = buildSchemaDatabase();
      const violations = findSchemaViolations(db, 'SELECT invented_column FROM user_api_keys');
      expect(violations).toHaveLength(1);
      expect(violations[0].error).toMatch(/no such column|has no column/i);
    });

    it('rejects an unknown column in an UPDATE target', () => {
      const { db } = buildSchemaDatabase();
      const violations = findSchemaViolations(
        db,
        'UPDATE user_api_keys SET invented_column = ? WHERE user_id = ?'
      );
      expect(violations).toHaveLength(1);
    });

    it('rejects a statement that still carries unresolved interpolation', () => {
      const { db } = buildSchemaDatabase();
      const violations = findSchemaViolations(
        db,
        'SELECT * FROM user_api_keys WHERE user_id = ${userId}'
      );
      expect(violations).toHaveLength(1);
    });

    it('rejects a query against the retired users table', () => {
      const { db } = buildSchemaDatabase();
      // Migration 0439 retired `users` in favour of Better Auth's `user`. A
      // hand-written schema that still declares `users` would let a stale query
      // pass here while production rejected it.
      const violations = findSchemaViolations(db, 'SELECT id, email FROM users WHERE id = ?');
      expect(violations).toHaveLength(1);
      expect(violations[0].error).toMatch(/no such table/i);
    });

    it('reports the table names production queries that no migration defines', () => {
      const { db } = buildSchemaDatabase();
      // Recorded, not asserted as green: production code references tables the
      // migration chain never creates. The harness must surface them rather than
      // accept them, and the packet records the disposition.
      for (const table of ['user_badges', 'byok_credentials', 'publishing_jobs']) {
        const exists = db
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
          .get(table);
        const violations = findSchemaViolations(db, `SELECT * FROM ${table}`);
        console.log(
          `${table}: defined=${Boolean(exists)} violations=${violations.length} ${
            violations[0]?.error ?? ''
          }`
        );
      }
    });
  });

  describe('the D1 wrapper surfaces the boundary at prepare time', () => {
    it('executes a valid statement and reports the affected row count', async () => {
      const { d1 } = createSchemaBoundD1();
      // `user` is created by the Better Auth migration, so the insert is real.
      const result = await d1
        .prepare('INSERT INTO user (id, email, name, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('u_boundary_1', 'boundary@example.invalid', 'Boundary', 0, 0, 0)
        .run();
      expect(result.meta.changes).toBe(1);

      const row = await d1
        .prepare('SELECT email FROM user WHERE id = ?')
        .bind('u_boundary_1')
        .first<{ email: string }>();
      expect(row?.email).toBe('boundary@example.invalid');
    });

    it('throws when a statement names a column the schema does not define', () => {
      const { d1 } = createSchemaBoundD1();
      expect(() => d1.prepare('SELECT not_a_column FROM user_api_keys')).toThrow(
        /Schema boundary violation/
      );
    });

    it('converts undefined binds to null rather than failing on the driver', async () => {
      const { db, d1 } = createSchemaBoundD1();
      void db;
      const result = await d1
        .prepare('UPDATE user SET name = ? WHERE id = ?')
        .bind(undefined, 'u_boundary_1')
        .run();
      // The statement executes; the row is found by id and its name set to null.
      expect(result.success).toBe(true);
    });
  });

  describe('measurement of the corpus is reproducible', () => {
    it('reports a stable table count across two builds', () => {
      const first = buildSchemaDatabase().report;
      const second = buildSchemaDatabase().report;
      expect(first.tableCount).toBe(second.tableCount);
      expect(first.migrationsApplied).toBe(second.migrationsApplied);
      expect(first.skippedMigrations.length).toBe(second.skippedMigrations.length);
    });

    it('exposes the schema database so callers can run migration-level checks', () => {
      const harness = makeSchemaBoundD1(buildSchemaDatabase().db);
      expect(typeof harness.prepare).toBe('function');
    });
  });
});
