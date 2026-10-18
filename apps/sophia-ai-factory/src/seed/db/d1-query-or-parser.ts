import type { FilterOp } from '@/seed/db/d1-query-types';

const OP_MAP: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  is: 'IS',
  like: 'LIKE',
};

const COL_ALLOWLIST = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * PostgREST-style OR filter parser. Parses comma-separated `col.op.val` pairs into FilterOp[].
 * Example: `expires_at.is.null,expires_at.gt.1234` -> `[{ col: 'expires_at', op: 'IS', val: null }, ...]`
 */
export function parseOrFilter(filterString: string): FilterOp[] {
  const group: FilterOp[] = [];
  for (const part of filterString.split(',')) {
    const [col, op, ...rest] = part.split('.');
    const rawVal = rest.join('.');
    if (!col || !op || !COL_ALLOWLIST.test(col)) continue;
    const sqlOp = OP_MAP[op];
    if (!sqlOp) continue;
    let val: unknown = rawVal;
    if (rawVal === 'null') {
      val = null;
    } else if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
      const num = Number(rawVal);
      if (!isNaN(num)) val = num;
    }
    group.push({ col, op: sqlOp, val });
  }
  return group;
}
