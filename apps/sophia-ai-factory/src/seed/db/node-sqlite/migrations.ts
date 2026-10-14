import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Apply the canonical migration set so the local shim mirrors the production
 * schema. Without this, every D1-backed check (auth rate limiting, quota
 * enforcement, circuit breaker) fails with "no such table" and fail-closed,
 * denying all requests with 429.
 *
 * Failures are non-fatal: migrations with ALTER/DROP on partially-migrated
 * state are skipped, and CREATE TABLE IF NOT EXISTS is idempotent.
 */
export function applyMigrations(db: InstanceType<typeof DatabaseSync>): void {
  try {
    const cwd = (process as unknown as { cwd?: () => string }).cwd?.() ?? '';
    const migDir = path.resolve(cwd, '../../migrations');
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
    // Non-fatal: migrations are best-effort for the local shim
  }
}
