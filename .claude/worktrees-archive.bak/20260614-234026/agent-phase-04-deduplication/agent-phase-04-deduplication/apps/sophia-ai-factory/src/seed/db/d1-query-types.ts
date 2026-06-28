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

export type FilterOp = { col: string; op: string; val: unknown };
export type OrderSpec = { col: string; ascending: boolean };
