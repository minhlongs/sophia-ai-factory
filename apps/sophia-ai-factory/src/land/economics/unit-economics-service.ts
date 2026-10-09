/**
 * Real-Time Unit Economics & Profitability Service - Root Facade.
 *
 * Aggregates financial and operational metrics from Cloudflare D1 across:
 * - `media_jobs`: provider_cost, latency, gross_margin, cost_classification
 * - `payment_events`: settled subscriptions, order values, activations
 * - `raas_licenses`: customer counts by tier (BASIC, PREMIUM, ENTERPRISE, MASTER)
 * - `commission_ledger`: affiliate CAC (payouts, commissions hold/payable)
 * - `edge_nodes`: active Apple Silicon edge nodes, hardware profiles, unmetered cost savings
 *
 * Layer: land (Domain service)
 *
 * @module land/economics/unit-economics-service
 */

export * from './unit';
