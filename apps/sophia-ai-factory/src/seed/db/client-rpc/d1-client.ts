import { toError } from '@/seed/utils/to-error';
import type { QueryResult } from '@/seed/db/d1-query-types';
import { D1QueryChain } from '@/seed/db/d1-query-chain';
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';
import { withD1Retry } from '@/seed/db/d1-retry';
import { debitMcuBalance, creditMcuBalance } from './rpc-balance';
import { incrementReferralCounter, incrementLlmCacheHit, incrementRateLimit } from './rpc-counters';
import { llmCacheStats, workflowStats24h, signalsTopEvents24h } from './rpc-stats';

/**
 * D1 Client — drop-in replacement for Supabase createServerClient()
 */
export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /** Raw D1Database binding — use sparingly */
  unwrap(): D1Database {
    return this.db;
  }

  /** Compatibility: forward prepare() for legacy code */
  prepare(sql: string): D1PreparedStatement {
    return this.db.prepare(sql);
  }

  /** Compatibility: direct execute for raw SQL with transient retry */
  async execute(sql: string, params?: unknown[]): Promise<D1Result> {
    const stmt = this.db.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    return withD1Retry(() => bound.run());
  }

  from<T = Record<string, unknown>>(table: string): D1QueryChain<T> {
    return new D1QueryChain<T>(this.db, table);
  }

  async rpc(fnName: string, params: Record<string, unknown> = {}): Promise<QueryResult<unknown>> {
    try {
      switch (fnName) {
        case 'debit_mcu_balance':
        case 'deduct_mcu_balance':
          return await debitMcuBalance(
            this.db,
            params.p_org_id as string,
            params.p_amount as number,
            params.p_feature as string,
          );
        case 'credit_mcu_balance':
          return await creditMcuBalance(
            this.db,
            params.p_org_id as string,
            params.p_amount as number,
            params.p_subscription_id as string,
          );
        case 'increment_referral_counter':
          return await incrementReferralCounter(this.db, params.p_code as string);
        case 'increment_llm_cache_hit':
          return await incrementLlmCacheHit(this.db, params.p_hash as string, params.p_org_id as string);
        case 'llm_cache_stats':
          return await llmCacheStats(this.db);
        case 'workflow_stats_24h':
          return await workflowStats24h(this.db);
        case 'signals_top_events_24h':
          return await signalsTopEvents24h(this.db, (params.p_limit as number | undefined) ?? 10);
        case 'increment_rate_limit':
          return await incrementRateLimit(
            this.db,
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
}
