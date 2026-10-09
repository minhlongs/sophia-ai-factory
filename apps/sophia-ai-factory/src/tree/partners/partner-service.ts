/**
 * Autonomous Multi-Tier Partner Commission Ledger & White-Label Agency Service
 *
 * Layer: tree (domain business logic, math models & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Guarantees:
 * 1. Zero Penny Leakage: Pure integer cent math with Math.floor((mrrCents * rate) / 100).
 * 2. Strict Anti-Self-Referral: Partners cannot earn commissions on their own orders.
 * 3. 90-Day Attribution Window: Attribution window checks prevent expired commission claims.
 * 4. Automatic Tier Escalation: Dynamically upgrades SILVER (20%) -> GOLD (28%) -> PLATINUM (35%).
 * 5. White-Label Isolation: Enforces tier permission before domain/branding provisioning.
 *
 * @module tree/partners/partner-service
 */

export * from './service';
