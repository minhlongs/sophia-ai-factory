// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type SqliteDb = DatabaseSync & { close(): void };

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');
const ROOT_GITIGNORE = path.resolve(__dirname, '../../../../../../.gitignore');

const LEGACY_USERS_PREREQ_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

const REQUIRED_BETTER_AUTH_SCHEMA: Record<string, readonly string[]> = {
  user: ['id', 'email', 'emailVerified', 'name', 'image', 'role', 'twoFactorEnabled', 'createdAt', 'updatedAt'],
  session: ['id', 'userId', 'expiresAt', 'token', 'ipAddress', 'userAgent', 'createdAt', 'updatedAt'],
  account: [
    'id',
    'userId',
    'accountId',
    'providerId',
    'accessToken',
    'refreshToken',
    'expiresAt',
    'password',
    'scope',
    'createdAt',
    'updatedAt',
    'idToken',
    'accessTokenExpiresAt',
    'refreshTokenExpiresAt',
  ],
  verification: ['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'],
  passkey: ['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'createdAt', 'aaguid'],
  twoFactor: ['id', 'secret', 'backupCodes', 'userId', 'verified', 'failedVerificationCount', 'lockedUntil'],
};

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function getTableColumns(db: SqliteDb, tableName: string): string[] {
  const rows = db.prepare(`SELECT name FROM pragma_table_info('${tableName}')`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

describe('Better Auth D1 SQLite Schema Parity Contract', () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = new DatabaseSync(':memory:') as SqliteDb;
    db.exec(LEGACY_USERS_PREREQ_SQL);
  });

  afterEach(() => {
    db.close();
  });

  it('reproduces the missing account token columns failure when migration 0485 is omitted', () => {
    db.exec(readMigration('0003-better-auth.sql'));
    db.exec(readMigration('0483_better_auth_two_factor_user_column.sql'));
    db.exec(readMigration('0484_better_auth_passkey_and_two_factor_tables.sql'));

    const accountCols = getTableColumns(db, 'account');
    expect(accountCols).not.toContain('idToken');
    expect(accountCols).not.toContain('accessTokenExpiresAt');
    expect(accountCols).not.toContain('refreshTokenExpiresAt');

    expect(() =>
      db.prepare('SELECT id, idToken, accessTokenExpiresAt, refreshTokenExpiresAt FROM account').all(),
    ).toThrow(/no such column: idToken/i);
  });

  it('satisfies all Better Auth v1.6+ table and column contracts after applying migration 0485', () => {
    db.exec(readMigration('0003-better-auth.sql'));
    db.exec(readMigration('0483_better_auth_two_factor_user_column.sql'));
    db.exec(readMigration('0484_better_auth_passkey_and_two_factor_tables.sql'));
    db.exec(readMigration('0485_better_auth_account_token_columns.sql'));

    for (const [table, requiredColumns] of Object.entries(REQUIRED_BETTER_AUTH_SCHEMA)) {
      const actualColumns = getTableColumns(db, table);
      for (const col of requiredColumns) {
        expect(actualColumns, `Table "${table}" is missing column "${col}"`).toContain(col);
      }
    }

    db.prepare('INSERT INTO "user" (id, email, name) VALUES (?, ?, ?)').run('u1', 'ceo@sophia.test', 'CEO');
    db.prepare(
      'INSERT INTO "account" (id, userId, accountId, providerId, idToken, accessTokenExpiresAt, refreshTokenExpiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('a1', 'u1', 'u1', 'credential', 'id-tok', '2026-12-31T00:00:00Z', '2027-01-31T00:00:00Z');

    const row = db
      .prepare('SELECT idToken, accessTokenExpiresAt, refreshTokenExpiresAt FROM "account" WHERE id = ?')
      .get('a1') as Record<string, string>;
    expect(row).toEqual({
      idToken: 'id-tok',
      accessTokenExpiresAt: '2026-12-31T00:00:00Z',
      refreshTokenExpiresAt: '2027-01-31T00:00:00Z',
    });
  });

  it('keeps migration 0485 guard_add_column compatible and allowlisted in root .gitignore', () => {
    const sql = readMigration('0485_better_auth_account_token_columns.sql');
    const alterLines = sql.split('\n').filter((line) => line.trim().toUpperCase().startsWith('ALTER TABLE'));
    expect(alterLines).toEqual([
      'ALTER TABLE account ADD COLUMN idToken TEXT;',
      'ALTER TABLE account ADD COLUMN accessTokenExpiresAt TEXT;',
      'ALTER TABLE account ADD COLUMN refreshTokenExpiresAt TEXT;',
    ]);

    const gitignore = fs.readFileSync(ROOT_GITIGNORE, 'utf-8');
    expect(gitignore).toContain('!apps/sophia-ai-factory/migrations/0485_better_auth_account_token_columns.sql');
  });
});
