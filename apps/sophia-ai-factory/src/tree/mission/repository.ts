/**
 * Mission repository — CRUD persistence for creative missions Facade
 * Layer: tree (domain-specific reusable)
 *
 * Pure data access and row mapping. Lifecycle transition rules live in
 * types.ts; metrics aggregation lives in metrics.ts.
 * Preserves 100% backward compatibility for all imports.
 *
 * @module tree/mission/repository
 */

export * from './repository/index';
