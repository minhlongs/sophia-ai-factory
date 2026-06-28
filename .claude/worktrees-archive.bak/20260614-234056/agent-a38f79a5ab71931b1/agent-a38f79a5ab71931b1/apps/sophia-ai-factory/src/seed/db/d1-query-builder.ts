/**
 * D1 Query Builder — barrel re-export
 *
 * Sub-modules:
 *   d1-query-types.ts      — QueryResult, QueryError, FilterOp, OrderSpec
 *   d1-query-utilities.ts  — parseJsonFields, serializeValue
 *   d1-query-chain.ts      — D1QueryChain (Supabase-compatible chainable API)
 *   d1-client-rpc.ts       — D1Client (drop-in for createServerClient) + rpc() dispatch
 */

export type { QueryResult, QueryError, FilterOp, OrderSpec } from './d1-query-types';
export { parseJsonFields, serializeValue } from './d1-query-utilities';
export { D1QueryChain } from './d1-query-chain';
export { D1Client } from './d1-client-rpc';
