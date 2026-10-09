/**
 * Enterprise Quote-to-Cash Workflow (Root Facade).
 *
 * Implements:
 * - Quote generation with volume discount calculations.
 * - Quote acceptance and contract generation with RFC-8785 canonical hash.
 * - Dual-sided digital signing of contracts (HMAC customer signature + platform signature).
 * - Dual-rail checkout payment initiation (NOWPayments USDT + PayOS VietQR).
 * - Payment fulfillment, E-Invoice status update, and automated MCU credit provisioning.
 *
 * Layer: land/contracts (Business domain workflow — imports seed, tree, and forest)
 *
 * @module land/contracts/quote-to-cash-workflow
 */

export * from './workflow';
