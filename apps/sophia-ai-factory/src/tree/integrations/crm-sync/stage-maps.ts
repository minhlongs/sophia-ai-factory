/**
 * @file stage-maps.ts
 * @description Bi-directional stage mappings and currency/cents unit conversions.
 * @layer tree
 */

import type { SophiaDealStage } from '../types';

// ── Stage Conversion Maps ───────────────────────────────────────────────────

export const SOPHIA_TO_SALESFORCE_STAGE_MAP: Record<SophiaDealStage, string> = {
  new_lead: 'Prospecting',
  enriching: 'Prospecting',
  qualified: 'Qualification',
  demo_prepared: 'Needs Analysis',
  demo_active: 'Value Proposition',
  proposal_sent: 'Proposal/Price Quote',
  negotiating: 'Proposal/Price Quote',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export const SALESFORCE_TO_SOPHIA_STAGE_MAP: Record<string, SophiaDealStage> = {
  Prospecting: 'new_lead',
  Qualification: 'qualified',
  'Needs Analysis': 'demo_prepared',
  'Value Proposition': 'demo_active',
  'Proposal/Price Quote': 'proposal_sent',
  'Negotiation/Review': 'negotiating',
  'Closed Won': 'closed_won',
  'Closed Lost': 'closed_lost',
};

export const SOPHIA_TO_HUBSPOT_STAGE_MAP: Record<SophiaDealStage, string> = {
  new_lead: 'appointmentscheduled',
  enriching: 'appointmentscheduled',
  qualified: 'qualifiedtobuy',
  demo_prepared: 'presentationscheduled',
  demo_active: 'decisionmakerboughtin',
  proposal_sent: 'contractsent',
  negotiating: 'contractsent',
  closed_won: 'closedwon',
  closed_lost: 'closedlost',
};

export const HUBSPOT_TO_SOPHIA_STAGE_MAP: Record<string, SophiaDealStage> = {
  appointmentscheduled: 'new_lead',
  qualifiedtobuy: 'qualified',
  presentationscheduled: 'demo_prepared',
  decisionmakerboughtin: 'demo_active',
  contractsent: 'proposal_sent',
  closedwon: 'closed_won',
  closedlost: 'closed_lost',
};

// ── Unit Conversions ────────────────────────────────────────────────────────

/**
 * Converts Sophia deal value in cents to decimal amount.
 * Example: 150000 cents -> 1500.00
 */
export function centsToDecimalAmount(valueCents: number): number {
  if (!Number.isFinite(valueCents) || valueCents <= 0) return 0;
  return Math.round(valueCents) / 100.0;
}

/**
 * Converts external decimal amount to Sophia integer cents.
 * Example: 1500.50 -> 150050 cents
 */
export function decimalAmountToCents(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null) return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 100);
}
