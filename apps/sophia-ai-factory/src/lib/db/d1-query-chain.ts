import { toError } from '@/lib/utils/to-error';
import type { QueryResult, FilterOp, OrderSpec } from './d1-query-types';
import { parseJsonFields, serializeValue } from './d1-query-utilities';

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
      return { data: null, error: { message: toError(err).message } };
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
