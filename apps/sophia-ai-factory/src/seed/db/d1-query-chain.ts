import type { QueryResult } from '@/seed/db/d1-query-types';
import { executeQuery, type QueryState } from '@/seed/db/d1-query-chain-executors';
import { D1FilterBuilder } from './d1-filter-builder';

/**
 * Chainable query builder for D1.
 * Usage mirrors Supabase: db.from('missions').select('*').eq('org_id', x).limit(10)
 */
export class D1QueryChain<T = Record<string, unknown>> extends D1FilterBuilder {
  private db: D1Database;
  private table: string;
  private selectCols = '*';
  private isSingle = false;
  private isMaybeSingle = false;
  private isCount = false;
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: Record<string, unknown> | Record<string, unknown>[] = {};
  private returnCols?: string;

  constructor(db: D1Database, table: string) {
    super();
    this.db = db;
    this.table = table;
  }

  private getState(): QueryState {
    return {
      db: this.db, table: this.table, selectCols: this.selectCols,
      filters: this.filters, inFilters: this.inFilters, orFilters: this.orFilters,
      orderSpecs: this.orderSpecs,
      limitVal: this.limitVal, offsetVal: this.offsetVal,
      isSingle: this.isSingle, isMaybeSingle: this.isMaybeSingle, isCount: this.isCount,
      operation: this.operation, payload: this.payload, returnCols: this.returnCols,
    };
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

  upsert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.operation = 'upsert';
    this.payload = data;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  single(): Promise<QueryResult<T>> {
    this.isSingle = true;
    return executeQuery(this.getState()) as Promise<QueryResult<T>>;
  }

  maybeSingle(): Promise<QueryResult<T | null>> {
    this.isMaybeSingle = true;
    return executeQuery(this.getState()) as Promise<QueryResult<T | null>>;
  }

  returning(cols: string): this { this.returnCols = cols; return this; }
  selectAfterMutation(cols: string): this { this.returnCols = cols; return this; }

  then<TResult1 = QueryResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return (executeQuery(this.getState()) as Promise<QueryResult<T[]>>).then(onfulfilled as never, onrejected);
  }
}
