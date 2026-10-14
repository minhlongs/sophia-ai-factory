import { createRequire } from 'module';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Statement, D1Result, LocalD1Database, SqliteDb } from './types';
import { SQLiteD1PreparedStatement } from './statement';
import { applyMigrations } from './sqlite-finder';

export class SQLiteD1Database implements LocalD1Database {
  private db: SqliteDb;

  constructor(sqlitePath: string) {
    if (
      typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined' &&
      process.env.NODE_ENV === 'production'
    ) {
      throw new Error('SQLiteD1Database is not supported in Edge Runtime');
    }
    const Database = createRequire(import.meta.url)('better-sqlite3');
    this.db = new Database(sqlitePath);
    this.db.pragma('foreign_keys = OFF');

    // Apply the canonical migration set so the local D1 mock mirrors the production schema.
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
      results.push((await stmt.run()) as D1Result);
    }
    return results;
  }

  async exec(query: string): Promise<void> {
    this.db.exec(query);
  }
}
