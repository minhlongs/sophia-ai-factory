/**
 * Affiliate Ledger Service - Root Facade.
 *
 * Provides D1 queries for affiliate statistics aggregation,
 * Optimistic Concurrency Control (OCC) for payout disbursement and
 * commission status transitions, and dual-rail settlement (USDT & VietQR).
 *
 * Layer: tree (domain reusable logic, zero forest/land imports).
 *
 * @module tree/affiliates/affiliate-ledger-service
 */

export * from './ledger';
