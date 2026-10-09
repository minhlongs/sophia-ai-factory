/**
 * Co-Op Marketing Funds & Automated Revenue-Share Settlement Engine
 *
 * Layer: tree (domain business logic, heuristic appraisal & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture (seed -> tree -> forest -> land).
 *
 * Thin facade re-exporting modularized domain components:
 * - Constants: Rates, 90-day expiry, 15-day grace period, ad network & brand keyword rules.
 * - Types: Domain DTOs and invoice appraisal contracts.
 * - Accrual Calculator: 5% monthly MRR allocation for Gold/Platinum partners.
 * - Heuristic Scorer: 0-100 heuristic appraisal scoring and $2,000 auto-approval gate.
 * - Claim Submission: Atomic budget solvency, duplicate invoice prevention, and claim insertion.
 * - Budget Sweeper: 90-day expiration sweeps and partner summary aggregations.
 *
 * @module tree/partners/co-op-engine
 */

export * from './co-op';
