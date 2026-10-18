import type { FilterOp, OrderSpec } from '@/seed/db/d1-query-types';
import { parseOrFilter } from './d1-query-or-parser';

export class D1FilterBuilder {
  protected filters: FilterOp[] = [];
  protected inFilters: { col: string; vals: unknown[] }[] = [];
  protected orFilters: FilterOp[][] = [];
  protected orderSpecs: OrderSpec[] = [];
  protected limitVal?: number;
  protected offsetVal?: number;

  eq(col: string, val: unknown): this { this.filters.push({ col, op: '=', val }); return this; }
  neq(col: string, val: unknown): this { this.filters.push({ col, op: '!=', val }); return this; }
  gt(col: string, val: unknown): this { this.filters.push({ col, op: '>', val }); return this; }
  gte(col: string, val: unknown): this { this.filters.push({ col, op: '>=', val }); return this; }
  lt(col: string, val: unknown): this { this.filters.push({ col, op: '<', val }); return this; }
  lte(col: string, val: unknown): this { this.filters.push({ col, op: '<=', val }); return this; }
  like(col: string, pattern: string): this { this.filters.push({ col, op: 'LIKE', val: pattern }); return this; }
  ilike(col: string, pattern: string): this { this.filters.push({ col, op: 'LIKE', val: pattern }); return this; }

  is(col: string, val: unknown): this {
    this.filters.push(val === null ? { col, op: 'IS', val: null } : { col, op: '=', val });
    return this;
  }

  in(col: string, vals: unknown[]): this { this.inFilters.push({ col, vals }); return this; }

  or(filterString: string): this {
    const group = parseOrFilter(filterString);
    if (group.length > 0) this.orFilters.push(group);
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

  limit(n: number): this { this.limitVal = n; return this; }

  range(from: number, to: number): this {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }
}
