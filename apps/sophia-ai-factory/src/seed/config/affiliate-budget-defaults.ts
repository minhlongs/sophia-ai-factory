/**
 * Canonical Affiliate & Niche Video Campaign Budget Defaults (Cents).
 *
 * - DEFAULT_MAX_RENDER_COST_CENTS: 250 ($2.50 per campaign default)
 * - PROPOSED_GATE1_VERTICAL_CAP_CENTS: 2500 ($25.00 per vertical unapproved proposal)
 * - PROPOSED_GATE1_TOTAL_CAP_CENTS: 5000 ($50.00 total across verticals unapproved proposal)
 *
 * Layer: seed/config
 * @module seed/config/affiliate-budget-defaults
 */

/** Default maximum render cost per campaign in cents ($2.50 USD). */
export const DEFAULT_MAX_RENDER_COST_CENTS = 250;

/** Default TTS voiceover reservation slice per campaign in cents ($0.50 USD). */
export const DEFAULT_TTS_RESERVE_CENTS = 50;

/** Unapproved proposed OPC Gate 1 ceiling per vertical in cents ($25.00 USD). */
export const PROPOSED_GATE1_VERTICAL_CAP_CENTS = 2500;

/** Unapproved proposed OPC Gate 1 combined ceiling across verticals in cents ($50.00 USD). */
export const PROPOSED_GATE1_TOTAL_CAP_CENTS = 5000;

