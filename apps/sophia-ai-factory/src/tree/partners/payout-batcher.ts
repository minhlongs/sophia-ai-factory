/**
 * Multi-Rail Batch Settlement & Payout Engine
 *
 * Layer: tree (domain business logic, OCC CAS claiming, multi-rail dispatch & atomic rollback)
 * Adheres strictly to the Sophia 4-layer architecture (seed -> tree -> forest -> land).
 *
 * Thin facade re-exporting modularized payout domain components:
 * - Constants: USD to VND rates and minimum batch thresholds.
 * - Types: Batch options, results, and gateway dispatchers.
 * - Currency Converter: Math.floor((cents * fxRate) / 100) integer dong arithmetic.
 * - Batch Creator: OCC CAS batch claiming for commissions & co-op claims.
 * - Batch Rollback: Zero-loss atomic state reversal on failure.
 * - Batch Executor: Simulated multi-rail gateway dispatchers.
 * - Batch Queries: Batch retrieval by ID or partner.
 *
 * @module tree/partners/payout-batcher
 */

export * from './payouts';
