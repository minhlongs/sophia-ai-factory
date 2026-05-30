import { toError } from '@/seed/utils/to-error';
import type { QueryResult } from '@/seed/db/d1-query-types';
import { D1QueryChain } from '@/seed/db/d1-query-chain';

/**
 * D1 Client — drop-in replacement for Supabase createServerClient()
 */
export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Returns the underlying D1Database binding.
   * Use sparingly — prefer the typed query methods on D1Client.
   * Currently only consumed by code paths that bridge to legacy raw-D1
   * helpers (e.g., schedule-publish.ts) pending full migration.
   */
  unwrap(): D1Database {
    return this.db;
  }

  from<T = Record<string, unknown>>(table: string): D1QueryChain<T> {
    return new D1QueryChain<T>(this.db, table);
  }

  async rpc(fnName: string, params: Record<string, unknown> = {}): Promise<QueryResult<unknown>> {
    try {
      switch (fnName) {
        case 'debit_mcu_balance':
        case 'deduct_mcu_balance':
          return await this.debitMcuBalance(
            params.p_org_id as string,
            params.p_amount as number,
            params.p_feature as string,
          );
        case 'credit_mcu_balance':
          return await this.creditMcuBalance(
            params.p_org_id as string,
            params.p_amount as number,
            params.p_subscription_id as string,
          );
        case 'increment_referral_counter':
          return await this.incrementReferralCounter(params.p_code as string);
        case 'increment_llm_cache_hit':
          return await this.incrementLlmCacheHit(params.p_hash as string, params.p_org_id as string);
        case 'llm_cache_stats':
          return await this.llmCacheStats();
        case 'workflow_stats_24h':
          return await this.workflowStats24h();
        case 'signals_top_events_24h':
          return await this.signalsTopEvents24h((params.p_limit as number | undefined) ?? 10);
        case 'increment_rate_limit':
          return await this.incrementRateLimit(
            params.p_identifier as string,
            params.p_window_seconds as number,
          );
        default:
          return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
      }
    } catch (err) {
      return { data: null, error: { message: toError(err).message } };
    }
  }

  private async debitMcuBalance(orgId: string, amount: number, feature: string): Promise<QueryResult<unknown>> {
    // Atomic CAS: single UPDATE with WHERE guard prevents TOCTOU double-spend.
    // If balance < amount or org_id doesn't exist, zero rows are written.
    const updateResult = await this.db
      .prepare(
        `UPDATE org_balances
         SET balance = balance - ?, updated_at = datetime('now')
         WHERE org_id = ? AND balance >= ?`,
      )
      .bind(amount, orgId, amount)
      .run();

    if (!updateResult.meta.rows_written || updateResult.meta.rows_written === 0) {
      return { data: null, error: { message: 'Insufficient balance' } };
    }

    // Balance already debited atomically above — now record the transaction
    await this.db
      .prepare('INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)')
      .bind(orgId, -amount, 'debit', feature)
      .run();

    return { data: { success: true }, error: null };
  }

  private async creditMcuBalance(orgId: string, amount: number, subscriptionId: string): Promise<QueryResult<unknown>> {
    await this.db.batch([
      this.db.prepare(
        'INSERT INTO org_balances (org_id, balance, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(org_id) DO UPDATE SET balance = balance + ?, updated_at = datetime(\'now\')'
      ).bind(orgId, amount, amount),
      this.db.prepare('INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)').bind(orgId, amount, 'credit', subscriptionId),
    ]);

    return { data: { success: true }, error: null };
  }

  private async incrementReferralCounter(code: string): Promise<QueryResult<unknown>> {
    await this.db
      .prepare('UPDATE referral_codes SET uses = uses + 1 WHERE code = ?')
      .bind(code)
      .run();
    return { data: { success: true }, error: null };
  }

  private async incrementLlmCacheHit(hash: string, orgId: string): Promise<QueryResult<unknown>> {
    await this.db
      .prepare('UPDATE llm_cache SET hit_count = hit_count + 1 WHERE hash = ? AND org_id = ?')
      .bind(hash, orgId)
      .run();
    return { data: { success: true }, error: null };
  }

  private async llmCacheStats(): Promise<QueryResult<unknown>> {
    const nowIso = new Date().toISOString();
    const row = await this.db
      .prepare(
        `SELECT
          COUNT(*)                                            AS total,
          COALESCE(SUM(CASE WHEN expires_at > ? THEN 1 ELSE 0 END), 0)    AS fresh,
          COALESCE(SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END), 0)   AS expired,
          COALESCE(SUM(hit_count), 0)                                     AS total_hits,
          COALESCE(SUM((COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) * hit_count), 0) AS tokens_saved
        FROM llm_cache`,
      )
      .bind(nowIso, nowIso)
      .first<{ total: number; fresh: number; expired: number; total_hits: number; tokens_saved: number }>();
    return { data: row ?? null, error: null };
  }

  private async workflowStats24h(): Promise<QueryResult<unknown>> {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const row = await this.db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'queued'    THEN 1 ELSE 0 END), 0) AS queued,
          COALESCE(SUM(CASE WHEN status = 'running'   THEN 1 ELSE 0 END), 0) AS running,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
          COALESCE(SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END), 0) AS failed
        FROM workflows
        WHERE created_at >= ?`,
      )
      .bind(sinceIso)
      .first<{ queued: number; running: number; completed: number; failed: number }>();
    return { data: row ?? null, error: null };
  }

  private async signalsTopEvents24h(limit: number): Promise<QueryResult<unknown>> {
    // signals_events.ts is INTEGER unix ms — bind as number, not ISO string
    // (migration 0005-signals-events.sql: `ts INTEGER NOT NULL`).
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const res = await this.db
      .prepare(
        `SELECT event_type, COUNT(*) AS cnt
         FROM signals_events
         WHERE ts >= ?
         GROUP BY event_type
         ORDER BY cnt DESC
         LIMIT ?`,
      )
      .bind(sinceMs, safeLimit)
      .all<{ event_type: string; cnt: number }>();
    return { data: res.results ?? [], error: null };
  }

  private async incrementRateLimit(
    identifier: string,
    windowSeconds: number,
  ): Promise<QueryResult<{ current_count: number }[]>> {
    // windowStart is unix seconds — rows older than this are expired
    const windowStart = Math.floor(Date.now() / 1000) - windowSeconds;
    const stmt = this.db.prepare(`
      INSERT INTO rate_limits (identifier, current_count, window_start, window_seconds)
      VALUES (?1, 1, datetime('now'), ?2)
      ON CONFLICT(identifier) DO UPDATE SET
        current_count = CASE
          WHEN CAST(strftime('%s', window_start) AS INTEGER) < ?3 THEN 1
          ELSE current_count + 1
        END,
        window_start = CASE
          WHEN CAST(strftime('%s', window_start) AS INTEGER) < ?3 THEN datetime('now')
          ELSE window_start
        END,
        updated_at = datetime('now')
      RETURNING current_count
    `);
    const row = await stmt
      .bind(identifier, windowSeconds, windowStart)
      .first<{ current_count: number }>();
    return { data: row ? [row] : null, error: null };
  }
}
