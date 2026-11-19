import { DatabaseSync } from 'node:sqlite';
type SQLInputValue = null | number | bigint | string | Uint8Array;
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Explicit dependency closure only; every migration executes in full, without error suppression.
export const migrations = [
  '0001-init.sql', '0002-payment-events.sql', '0003-better-auth.sql',
  '0004-user-profiles.sql', '0005-signals-events.sql', '0011-user-api-keys.sql',
  '0013-rate-limits.sql', '0020-user-profiles-extend.sql', '0028-mfa-secrets.sql',
  '0029-mfa-pending-sessions.sql', '0046-user-provider-credentials.sql',
  '0053-mcu-credits.sql', '0070-pending-orders.sql', '0071-payment-events-receipt-flag.sql',
  '0072-payos-events.sql', '0086-subscriptions-add-user-tier.sql',
  '0087-subscriptions-drop-user-id-fk.sql', '0088-org-members-drop-user-id-fk.sql',
  '0144_platform_credentials.sql', '0184_key_versions.sql', '0188_add_amount_vnd_to_pending_orders.sql',
  '0240_agent_runs.sql', '0272_user_profiles_role.sql', '0281_user_api_keys_key_validated_at.sql',
  '0477_payos_contract_fulfillment.sql', '0483_better_auth_two_factor_user_column.sql',
  '0484_better_auth_passkey_and_two_factor_tables.sql', '0485_better_auth_account_token_columns.sql',
  '0499_byok_key_policy_and_publish_ledger.sql',
  '0503_reconcile_pending_orders_provider_payment_id.sql', '0504_pending_orders_provider_payment_id_index.sql',
] as const;

export function createSqliteFixture() {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of migrations) sqlite.exec(readFileSync(resolve('migrations', migration), 'utf8'));
  sqlite.exec('PRAGMA foreign_keys = ON');
  const errors: string[] = [];
  function prepare(sql: string) {
    let highest = 0;
    const normalized = sql.replace(/\?(\d*)/g, (_, index: string) => {
      highest = index ? Math.max(highest, Number(index)) : highest + 1;
      return `?${index || highest}`;
    });
    let values: SQLInputValue[] = [];
    const invoke = <T>(operation: (statement: ReturnType<DatabaseSync['prepare']>, bindings: Record<string, SQLInputValue>) => T): T => {
      try {
        const statement = sqlite.prepare(normalized);
        const bindings = Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
        return operation(statement, bindings);
      } catch (error) {
        errors.push(`${sql.split(/\s+/).slice(0, 8).join(' ')}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    };
    return {
      bind(...args: unknown[]) {
        values = args.map(value => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value instanceof ArrayBuffer ? new Uint8Array(value) : value as SQLInputValue);
        return this;
      },
      async first<T>(column?: string): Promise<T | null> {
        return invoke((statement, bindings) => {
          const row = statement.get(bindings) as Record<string, unknown> | undefined;
          return (row ? column ? row[column] : row : null) as T | null;
        });
      },
      async all<T>() {
        return invoke((statement, bindings) => ({ success: true, results: statement.all(bindings) as T[], meta: { changes: 0, duration: 0 } }));
      },
      execute() {
        return invoke((statement, bindings) => {
          const results = statement.all(bindings);
          const info = sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get() as { changes: number; last_row_id: number };
          return { success: true, results, meta: { changes: Number(info?.changes ?? 0), last_row_id: Number(info?.last_row_id ?? 0), duration: 0 } };
        });
      },
      async run() { return this.execute(); },
      async raw() { return invoke((statement, bindings) => (statement.all(bindings) as Record<string, unknown>[]).map(row => Object.values(row))); },
    };
  }
  sqlite.exec(`CREATE TABLE usage_events (id TEXT PRIMARY KEY, user_id TEXT, license_nonce TEXT, credits_used REAL, created_at INTEGER)`);
  const binding = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) { sqlite.exec(sql); return { count: 1, duration: 0 }; },
  };
  return { sqlite, binding, errors };
}
