/**
 * Local D1 mock — SQLite-backed fallback for development and testing.
 *
 * Provides a D1-compatible interface using better-sqlite3 when the
 * Cloudflare Workers D1 binding is unavailable (local dev, unit tests).
 *
 * Edge runtime is NOT supported — returns null from getLocalD1Mock().
 */

import { logger } from '@/seed/utils/logger-utility';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';

// ---- Types ----

/** Minimal D1 binding interface for prepared statements */
export interface D1Statement {
bind(...values: unknown[]): D1Statement;
first<T = unknown>(colName?: string): Promise<T | null>;
run(): Promise<{ success: boolean; results: unknown[]; meta: { changes: number; last_row_id: number; duration: number } }>;
all<T = unknown>(): Promise<{ success: boolean; results: T[]; meta: { changes: number; duration: number } }>;
raw(): Promise<unknown[]>;
}

/** Local D1 database interface (distinct from cloudflare D1Database) */
export interface LocalD1Database {
prepare(query: string): D1Statement;
exec(query: string): Promise<void>;
dump(): Promise<ArrayBuffer>;
batch(statements: D1Statement[]): Promise<D1Result[]>;
}

export interface D1Result {
success: boolean;
results: unknown[];
meta: { changes: number; last_row_id: number; duration: number };
}

/** Minimal better-sqlite3 interface */
interface SqliteDb {
prepare(sql: string): SqliteStmt;
exec(sql: string): void;
pragma(sql: string): void;
}

interface SqliteStmt {
get(...bindings: unknown[]): Record<string, unknown> | undefined;
run(...bindings: unknown[]): { changes: number; lastInsertRowid: number };
all(...bindings: unknown[]): Record<string, unknown>[];
raw(all: boolean): SqliteStmt;
}

// Apply canonical D1 migrations so the local mock mirrors production schema.
// Failures are non-fatal: migrations with ALTER/DROP on partially-migrated
// state are skipped, and CREATE TABLE IF NOT EXISTS is idempotent.
function applyMigrations(db: SqliteDb): void {
  try {
    const migDir = path.resolve(
      ((globalThis as unknown) as Record<string, { cwd?: () => string }>).
        process?.cwd?.() || '',
      '../../migrations',
    );
    if (!fs.existsSync(migDir)) return;
    const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql')).sort();
    for (const f of files) {
      try {
        db.exec(fs.readFileSync(path.join(migDir, f), 'utf-8'));
      } catch {
        // Non-fatal: skip migrations that depend on partial state
      }
    }
  } catch {
    // Non-fatal: migrations are best-effort for the local mock
  }
}

// ---- Helpers ----

function findLocalD1Path(): string | null {
// Edge runtime does not support Node.js filesystem APIs, bypass.
// Production CF Workers define EdgeRuntime and truly cannot run
// better-sqlite3, so bail there. In dev, Next.js also defines EdgeRuntime
// on the edge chunk (middleware/proxy) but that chunk actually runs on
// Node.js (Turbopack dev server) where better-sqlite3 is available, so
// only bail when we are genuinely in a production edge context.
if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined' && process.env.NODE_ENV === 'production') {
return null;
}

try {
const cwd = ((globalThis as unknown) as Record<string, { cwd?: () => string }>).process?.cwd?.() || '';
const homeDir = ((globalThis as unknown) as Record<string, { env?: Record<string, string | undefined> }>).process?.env?.HOME || '';
const candidates = [
path.resolve(cwd, '../..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
path.resolve(cwd, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
path.resolve(cwd, '..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
// Home-dir wrangler state (wrangler stores local D1 here via `d1 execute --local` / `wrangler dev --local`)
...(homeDir ? [
  path.resolve(homeDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
  path.resolve(homeDir, '.wrangler/state/v3/d1'),
] : []),
];

let newestFile: string | null = null;
let newestTime = 0;

for (const base of candidates) {
if (!fs.existsSync(base)) continue;
const files = fs
.readdirSync(base)
.filter((f: string) => f.endsWith('.sqlite') && !f.includes('metadata'))
.map((f: string) => path.join(base, f));

for (const file of files) {
try {
// In SQLite WAL mode, updates are written to -wal file, leaving the main .sqlite file mtime outdated.
// We look at the maximum mtime of the .sqlite, .sqlite-wal, and .sqlite-shm files.
let maxFileTime = 0;
for (const ext of ['', '-wal', '-shm']) {
try {
const stats = fs.statSync(file + ext);
if (stats.mtimeMs > maxFileTime) {
maxFileTime = stats.mtimeMs;
}
} catch {}
}

if (maxFileTime > newestTime) {
newestTime = maxFileTime;
newestFile = file;
}
} catch {}
}
}
return newestFile;
} catch {
return null;
}
}

// ---- SQLite-backed D1 implementation ----

class SQLiteD1PreparedStatement implements D1Statement {
private db: SqliteDb;
private query: string;
private bindings: unknown[];

constructor(db: SqliteDb, query: string, bindings: unknown[] = []) {
this.db = db;
this.query = query;
this.bindings = bindings.map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
}

bind(...values: unknown[]): D1Statement {
const resolvedValues = (values.length === 1 && Array.isArray(values[0])) ? values[0] : values;
return new SQLiteD1PreparedStatement(this.db, this.query, resolvedValues);
}

private getProcessedBindings(): Record<string, unknown> | unknown[] {
if (/\?\d+/.test(this.query) && Array.isArray(this.bindings)) {
const boundObj: Record<string, unknown> = {};
this.bindings.forEach((val, idx) => {
boundObj[String(idx + 1)] = val;
});
return boundObj;
}
return this.bindings;
}

async first<T = unknown>(colName?: string): Promise<T | null> {
try {
const stmt = this.db.prepare(this.query);
const processed = this.getProcessedBindings();
const result = Array.isArray(processed) ? stmt.get(...processed) : stmt.get(processed);
if (!result) return null;
if (colName) return result[colName] as T;
return result as T;
} catch (e) {
logger.error(`[D1 mock] error on first(): ${this.query}`, e instanceof Error ? e : new Error(String(e)));
throw e;
}
}

async run(): Promise<{ success: boolean; results: unknown[]; meta: { changes: number; last_row_id: number; duration: number } }> {
try {
const stmt = this.db.prepare(this.query);
const processed = this.getProcessedBindings();
const info = Array.isArray(processed) ? stmt.run(...processed) : stmt.run(processed);
return {
success: true,
results: [],
meta: {
changes: info.changes,
last_row_id: info.lastInsertRowid,
duration: 0,
},
};
} catch (e) {
logger.error(`[D1 mock] error on run(): ${this.query}`, e instanceof Error ? e : new Error(String(e)));
throw e;
}
}

async all<T = unknown>(): Promise<{ success: boolean; results: T[]; meta: { changes: number; duration: number } }> {
try {
const stmt = this.db.prepare(this.query);
const processed = this.getProcessedBindings();
const rawResults = Array.isArray(processed) ? stmt.all(...processed) : stmt.all(processed);
return {
success: true,
results: rawResults as unknown as T[],
meta: {
changes: 0,
duration: 0,
},
};
} catch (e) {
logger.error(`[D1 mock] error on all(): ${this.query}`, e instanceof Error ? e : new Error(String(e)));
throw e;
}
}

async raw(): Promise<unknown[]> {
try {
const stmt = this.db.prepare(this.query);
const processed = this.getProcessedBindings();
const rawResult = Array.isArray(processed) ? stmt.raw(true).all(...processed) : stmt.raw(true).all(processed);
return rawResult as unknown[];
} catch (e) {
logger.error(`[D1 mock] error on raw(): ${this.query}`, e instanceof Error ? e : new Error(String(e)));
throw e;
}
}
}

class SQLiteD1Database implements LocalD1Database {
private db: SqliteDb;

constructor(sqlitePath: string) {
if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined' && process.env.NODE_ENV === 'production') {
throw new Error('SQLiteD1Database is not supported in Edge Runtime');
}
const Database = createRequire(import.meta.url)('better-sqlite3');
this.db = new Database(sqlitePath);
this.db.pragma('foreign_keys = OFF');

// Apply the canonical migration set so the local D1 mock mirrors the
// production schema. Without this, every D1-backed check (auth rate
// limiting, quota enforcement, circuit breaker) fails with
// "no such table" and fail-closed, denying all requests with 429.
applyMigrations(this.db);

// Ensure dunning tables exist for local testing and dev flow
this.db.exec(`
CREATE TABLE IF NOT EXISTS dunning_settings (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
license_nonce TEXT NOT NULL UNIQUE,
polar_customer_id TEXT,
stripe_customer_id TEXT,
grace_period_days INTEGER DEFAULT 3,
max_retry_attempts INTEGER DEFAULT 4,
retry_schedule TEXT DEFAULT '["1 day", "3 days", "7 days", "15 days"]',
send_email_notifications INTEGER DEFAULT 1,
email_language TEXT DEFAULT 'en',
dunning_state TEXT DEFAULT 'current',
dunning_state_changed_at TEXT,
created_at TEXT,
updated_at TEXT
);

CREATE TABLE IF NOT EXISTS dunning_attempts (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
license_nonce TEXT NOT NULL,
attempt_number INTEGER NOT NULL DEFAULT 1,
attempt_type TEXT NOT NULL,
payment_provider TEXT NOT NULL,
success INTEGER DEFAULT 0,
amount REAL,
currency TEXT DEFAULT 'USD',
failure_reason TEXT,
provider_response_id TEXT,
dunning_state_before TEXT,
dunning_state_after TEXT,
next_retry_at TEXT,
scheduled_retry_count INTEGER DEFAULT 0,
ip_address TEXT,
user_agent TEXT,
created_at TEXT,
stripe_invoice_id TEXT,
polar_order_id TEXT
);

CREATE TABLE IF NOT EXISTS platform_configs (
key TEXT PRIMARY KEY,
encrypted_value TEXT NOT NULL,
updated_by TEXT,
updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_platform_configs_updated ON platform_configs(updated_at);

CREATE TABLE IF NOT EXISTS billing_events (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
license_nonce TEXT NOT NULL,
event_type TEXT NOT NULL,
event_category TEXT NOT NULL,
event_data TEXT DEFAULT '{}',
amount REAL,
currency TEXT DEFAULT 'USD',
payment_provider TEXT,
provider_event_id TEXT,
provider_invoice_id TEXT,
provider_charge_id TEXT,
email_sent INTEGER DEFAULT 0,
email_template TEXT,
email_recipient TEXT,
email_sent_at TEXT,
ip_address TEXT,
user_agent TEXT,
created_at TEXT,
processed INTEGER DEFAULT 0,
processed_at TEXT
);
`);
}

prepare(query: string): D1Statement {
return new SQLiteD1PreparedStatement(this.db, query);
}

async dump(): Promise<ArrayBuffer> {
throw new Error('Dump not implemented in local D1 mock');
}

async batch(statements: D1Statement[]): Promise<D1Result[]> {
const results: D1Result[] = [];
for (const stmt of statements) {
results.push(await stmt.run() as D1Result);
}
return results;
}

async exec(query: string): Promise<void> {
this.db.exec(query);
}
}

// ---- Public API ----

/**
 * Get local SQLite D1 fallback database if wrangler D1 is not available.
 * Returns null if not running in development/test or if local database file doesn't exist.
 */
export function getLocalD1Mock(): LocalD1Database | null {
if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined' && process.env.NODE_ENV === 'production') {
return null;
}

// Only attempt the local D1 mock when a local wrangler D1 sqlite exists.
// The previous NODE_ENV gate returned null for production builds and for
// dev/test servers that don't set NODE_ENV, which made getD1() fall through
// to null and caused every D1-backed rate-limit check to fail-closed
// (denying all requests with 429). The binding is only useful when the
// file is actually present, so gate on that instead.
const sqlitePath = findLocalD1Path();
if (!sqlitePath) {
logger.warn('[D1 mock] Local wrangler state D1 sqlite not found. Did you run pnpm dev/setup?');
return null;
}

try {
return new SQLiteD1Database(sqlitePath);
} catch (e) {
logger.error('[D1 mock] Failed to initialize local D1 database mock', e instanceof Error ? e : new Error(String(e)));
return null;
}
}
