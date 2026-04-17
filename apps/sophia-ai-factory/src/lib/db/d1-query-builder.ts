/**
 * D1 Query Builder — Supabase-compatible API wrapper for Cloudflare D1
 *
 * Provides .from('table').select().eq().single() chain API so existing
 * code needs minimal changes when migrating from Supabase to D1.
 */

// Result types matching Supabase response shape
export interface QueryResult<T = Record<string, unknown>> {
  data: T | null;
  error: QueryError | null;
  count?: number;
}

export interface QueryError {
  message: string;
  code?: string;
}

type FilterOp = { col: string; op: string; val: unknown };
type OrderSpec = { col: string; ascending: boolean };

/**
 * Chainable query builder for D1.
 * Usage mirrors Supabase: db.from('missions').select('*').eq('org_id', x).limit(10)
 */
export class D1QueryChain<T = Record<string, unknown>> {
  private db: D1Database;
  private table: string;
  private selectCols = '*';
  private filters: FilterOp[] = [];
  private inFilters: { col: string; vals: unknown[] }[] = [];
  private orderSpecs: OrderSpec[] = [];
  private limitVal?: number;
  private offsetVal?: number;
  private isSingle = false;
  private isMaybeSingle = false;
  private isCount = false;

  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: Record<string, unknown> | Record<string, unknown>[] = {};
  private returnCols?: string;

  constructor(db: D1Database, table: string) {
    this.db = db;
    this.table = table;
  }

  select(cols = '*', opts?: { count?: string; head?: boolean }): this {
    this.selectCols = cols;
    this.operation = 'select';
    if (opts?.count) this.isCount = true;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.operation = 'insert';
    this.payload = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.operation = 'update';
    this.payload = data;
    return this;
  }

  upsert(data: Record<string, unknown>): this {
    this.operation = 'upsert';
    this.payload = data;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ col, op: '=', val });
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push({ col, op: '!=', val });
    return this;
  }

  gt(col: string, val: unknown): this {
    this.filters.push({ col, op: '>', val });
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push({ col, op: '>=', val });
    return this;
  }

  lt(col: string, val: unknown): this {
    this.filters.push({ col, op: '<', val });
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push({ col, op: '<=', val });
    return this;
  }

  like(col: string, pattern: string): this {
    this.filters.push({ col, op: 'LIKE', val: pattern });
    return this;
  }

  ilike(col: string, pattern: string): this {
    this.filters.push({ col, op: 'LIKE', val: pattern });
    return this;
  }

  is(col: string, val: unknown): this {
    if (val === null) {
      this.filters.push({ col, op: 'IS', val: null });
    } else {
      this.filters.push({ col, op: '=', val });
    }
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.inFilters.push({ col, vals });
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    if (op === 'eq') this.filters.push({ col, op: '!=', val });
    else if (op === 'is' && val === null) this.filters.push({ col, op: 'IS NOT', val: null });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderSpecs.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }

  single(): Promise<QueryResult<T>> {
    this.isSingle = true;
    return this.execute() as Promise<QueryResult<T>>;
  }

  maybeSingle(): Promise<QueryResult<T | null>> {
    this.isMaybeSingle = true;
    return this.execute() as Promise<QueryResult<T | null>>;
  }

  returning(cols: string): this {
    this.returnCols = cols;
    return this;
  }

  selectAfterMutation(cols: string): this {
    this.returnCols = cols;
    return this;
  }

  then<TResult1 = QueryResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return (this.execute() as Promise<QueryResult<T[]>>).then(onfulfilled as never, onrejected);
  }

  private buildWhere(): { clause: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];

    for (const f of this.filters) {
      if (f.op === 'IS' && f.val === null) {
        parts.push(`${f.col} IS NULL`);
      } else if (f.op === 'IS NOT' && f.val === null) {
        parts.push(`${f.col} IS NOT NULL`);
      } else {
        parts.push(`${f.col} ${f.op} ?`);
        params.push(f.val);
      }
    }

    for (const inf of this.inFilters) {
      const placeholders = inf.vals.map(() => '?').join(', ');
      parts.push(`${inf.col} IN (${placeholders})`);
      params.push(...inf.vals);
    }

    const clause = parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : '';
    return { clause, params };
  }

  private async execute(): Promise<QueryResult<unknown>> {
    try {
      switch (this.operation) {
        case 'select': return await this.execSelect();
        case 'insert': return await this.execInsert();
        case 'update': return await this.execUpdate();
        case 'upsert': return await this.execUpsert();
        case 'delete': return await this.execDelete();
        default:
          return { data: null, error: { message: `Unknown operation: ${this.operation}` } };
      }
    } catch (err) {
      return { data: null, error: { message: (err as Error).message } };
    }
  }

  private async execSelect(): Promise<QueryResult<unknown>> {
    const { clause, params } = this.buildWhere();
    let sql = `SELECT ${this.selectCols} FROM ${this.table}${clause}`;

    for (const o of this.orderSpecs) {
      sql += ` ORDER BY ${o.col} ${o.ascending ? 'ASC' : 'DESC'}`;
    }
    if (this.limitVal !== undefined) sql += ` LIMIT ${this.limitVal}`;
    if (this.offsetVal !== undefined) sql += ` OFFSET ${this.offsetVal}`;

    const stmt = this.db.prepare(sql).bind(...params);

    if (this.isSingle || this.isMaybeSingle) {
      const result = await stmt.first<T>();
      if (!result && this.isSingle) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: parseJsonFields(result), error: null };
    }

    const result = await stmt.all<T>();
    const rows = (result.results ?? []).map(parseJsonFields);

    if (this.isCount) {
      const countSql = `SELECT COUNT(*) as cnt FROM ${this.table}${clause}`;
      const countResult = await this.db.prepare(countSql).bind(...params).first<{ cnt: number }>();
      return { data: rows, count: countResult?.cnt ?? rows.length, error: null } as QueryResult<unknown> & { count: number };
    }

    return { data: rows, error: null };
  }

  private async execInsert(): Promise<QueryResult<unknown>> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const results: unknown[] = [];

    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = Object.values(row).map(serializeValue);
      const placeholders = cols.map(() => '?').join(', ');
      const sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`;
      await this.db.prepare(sql).bind(...vals).run();

      if (this.returnCols || this.selectCols !== '*') {
        const selectCols = this.returnCols ?? this.selectCols;
        const idVal = row.id ?? row.key_hash ?? row.email;
        const idCol = row.id ? 'id' : row.key_hash ? 'key_hash' : 'email';
        if (idVal) {
          const fetched = await this.db
            .prepare(`SELECT ${selectCols} FROM ${this.table} WHERE ${idCol} = ? LIMIT 1`)
            .bind(idVal)
            .first();
          results.push(parseJsonFields(fetched));
        } else {
          const fetched = await this.db
            .prepare(`SELECT ${selectCols} FROM ${this.table} ORDER BY rowid DESC LIMIT 1`)
            .first();
          results.push(parseJsonFields(fetched));
        }
      } else {
        results.push(row);
      }
    }

    const data = this.isSingle ? results[0] ?? null : results;
    return { data, error: null };
  }

  private async execUpdate(): Promise<QueryResult<unknown>> {
    const row = this.payload as Record<string, unknown>;
    const cols = Object.keys(row);
    const vals = cols.map((c) => serializeValue(row[c]));
    const setClauses = cols.map((c) => `${c} = ?`).join(', ');
    const { clause, params } = this.buildWhere();

    const sql = `UPDATE ${this.table} SET ${setClauses}${clause}`;
    await this.db.prepare(sql).bind(...vals, ...params).run();

    if (this.returnCols || this.isSingle) {
      const selectCols = this.returnCols ?? this.selectCols;
      const fetchSql = `SELECT ${selectCols} FROM ${this.table}${clause}`;
      if (this.isSingle) {
        const result = await this.db.prepare(fetchSql).bind(...params).first();
        if (!result) return { data: null, error: { message: 'No rows updated' } };
        return { data: parseJsonFields(result), error: null };
      }
      const result = await this.db.prepare(fetchSql).bind(...params).all();
      return { data: (result.results ?? []).map(parseJsonFields), error: null };
    }

    return { data: null, error: null };
  }

  private async execUpsert(): Promise<QueryResult<unknown>> {
    const row = this.payload as Record<string, unknown>;
    const cols = Object.keys(row);
    const vals = cols.map((c) => serializeValue(row[c]));
    const placeholders = cols.map(() => '?').join(', ');
    const updateClauses = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');

    const sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO UPDATE SET ${updateClauses}`;
    await this.db.prepare(sql).bind(...vals).run();

    if (this.isSingle && row.id) {
      const fetched = await this.db
        .prepare(`SELECT * FROM ${this.table} WHERE id = ?`)
        .bind(row.id)
        .first();
      return { data: parseJsonFields(fetched), error: null };
    }

    return { data: row, error: null };
  }

  private async execDelete(): Promise<QueryResult<unknown>> {
    const { clause, params } = this.buildWhere();
    const sql = `DELETE FROM ${this.table}${clause}`;
    await this.db.prepare(sql).bind(...params).run();
    return { data: null, error: null };
  }
}

// JSON fields in D1 are stored as TEXT — auto-parse on read
function parseJsonFields<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try { out[k] = JSON.parse(v); } catch { /* keep as string */ }
    }
  }
  return out as T;
}

// Serialize objects/arrays to JSON string for D1 storage
function serializeValue(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

/**
 * D1 Client — drop-in replacement for Supabase createServerClient()
 */
export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
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
          return await this.incrementLlmCacheHit(params.p_hash as string);
        case 'llm_cache_stats':
          return await this.llmCacheStats();
        case 'workflow_stats_24h':
          return await this.workflowStats24h();
        case 'signals_top_events_24h':
          return await this.signalsTopEvents24h((params.p_limit as number | undefined) ?? 10);
        default:
          return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
      }
    } catch (err) {
      return { data: null, error: { message: (err as Error).message } };
    }
  }

  private async debitMcuBalance(orgId: string, amount: number, feature: string): Promise<QueryResult<unknown>> {
    const current = await this.db
      .prepare('SELECT balance FROM org_balances WHERE org_id = ?')
      .bind(orgId)
      .first<{ balance: number }>();

    if (!current || current.balance < amount) {
      return { data: null, error: { message: 'Insufficient balance' } };
    }

    await this.db.batch([
      this.db.prepare('UPDATE org_balances SET balance = balance - ?, updated_at = datetime(\'now\') WHERE org_id = ?').bind(amount, orgId),
      this.db.prepare('INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)').bind(orgId, -amount, 'debit', feature),
    ]);

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

  private async incrementLlmCacheHit(hash: string): Promise<QueryResult<unknown>> {
    await this.db
      .prepare('UPDATE llm_cache SET hit_count = hit_count + 1 WHERE hash = ?')
      .bind(hash)
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
}
