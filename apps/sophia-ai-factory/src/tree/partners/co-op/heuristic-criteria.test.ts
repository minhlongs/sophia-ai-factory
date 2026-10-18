import { describe, expect, it } from 'vitest';
import { CO_OP_BUDGET_EXPIRY_MS, CO_OP_GRACE_PERIOD_MS } from './constants';
import type { InvoiceAppraisalInput } from './types';
import {
  auditBudgetCriterion,
  auditDateCriterion,
  auditProofCriterion,
  auditVendorCriterion,
} from './heuristic-criteria';

function appraisalInput(overrides: Partial<InvoiceAppraisalInput> = {}): InvoiceAppraisalInput {
  return {
    invoiceDate: 0,
    requestedAmountCents: 1_000,
    availableBudgetCents: 2_000,
    ...overrides,
  };
}

describe('auditVendorCriterion', () => {
  it('accepts explicitly whitelisted vendors before inspecting vendor text', () => {
    const notes: string[] = [];

    expect(auditVendorCriterion(appraisalInput({ isWhitelistedVendor: true }), notes)).toBe(true);
    expect(notes).toEqual(['Vendor explicitly marked whitelisted.']);
  });

  it('matches verified ad networks case-insensitively across supplied vendor context', () => {
    const notes: string[] = [];

    expect(auditVendorCriterion(appraisalInput({ invoiceUrl: 'https://ads.GOOGLE.example/invoice' }), notes)).toBe(true);
    expect(notes).toEqual(['Vendor verified against ad network whitelist: [google].']);
  });

  it('rejects unrecognized vendors and records the reason', () => {
    const notes: string[] = [];

    expect(auditVendorCriterion(appraisalInput({ vendorName: 'Unknown Media Ltd.' }), notes)).toBe(false);
    expect(notes).toEqual(['Vendor not recognized on verified ad network whitelist (-25 pts).']);
  });
});

describe('auditDateCriterion', () => {
  const now = 2_000_000_000_000;

  it('accepts both inclusive billing-cycle grace boundaries and rejects dates outside them', () => {
    const periodStart = now - 30 * 86_400_000;
    const periodEnd = now;
    const notes: string[] = [];

    expect(auditDateCriterion(appraisalInput({ invoiceDate: periodStart - CO_OP_GRACE_PERIOD_MS, periodStart, periodEnd }), now, notes)).toBe(true);
    expect(auditDateCriterion(appraisalInput({ invoiceDate: periodEnd + CO_OP_GRACE_PERIOD_MS, periodStart, periodEnd }), now, notes)).toBe(true);
    expect(auditDateCriterion(appraisalInput({ invoiceDate: periodStart - CO_OP_GRACE_PERIOD_MS - 1, periodStart, periodEnd }), now, notes)).toBe(false);
    expect(auditDateCriterion(appraisalInput({ invoiceDate: periodEnd + CO_OP_GRACE_PERIOD_MS + 1, periodStart, periodEnd }), now, notes)).toBe(false);
    expect(notes).toHaveLength(4);
    expect(notes[0]).toContain('within billing cycle window');
    expect(notes[2]).toContain('outside billing cycle window');
  });

  it('uses the rolling 90-day window when billing-cycle bounds are incomplete', () => {
    const earliest = now - CO_OP_BUDGET_EXPIRY_MS - CO_OP_GRACE_PERIOD_MS;
    const latest = now + 86_400_000;
    const notes: string[] = [];

    expect(auditDateCriterion(appraisalInput({ invoiceDate: earliest }), now, notes)).toBe(true);
    expect(auditDateCriterion(appraisalInput({ invoiceDate: latest, periodStart: now }), now, notes)).toBe(true);
    expect(auditDateCriterion(appraisalInput({ invoiceDate: earliest - 1 }), now, notes)).toBe(false);
    expect(auditDateCriterion(appraisalInput({ invoiceDate: latest + 1 }), now, notes)).toBe(false);
    expect(notes[0]).toContain('rolling 90-day window');
    expect(notes[2]).toContain('expired');
  });
});

describe('auditProofCriterion', () => {
  it('accepts proof URLs with Sophia brand context from any supported metadata field', () => {
    const notes: string[] = [];

    expect(auditProofCriterion(appraisalInput({ proofUrl: 'https://files.example/proof.png', campaignName: 'Spring launch for Sophia AI' }), notes)).toBe(true);
    expect(auditProofCriterion(appraisalInput({ invoiceUrl: 'https://files.example/invoice.pdf', brandKeywords: ['AgencyOS'] }), notes)).toBe(true);
    expect(notes).toEqual([
      'Campaign proof attached and verified with Sophia brand keywords.',
      'Campaign proof attached and verified with Sophia brand keywords.',
    ]);
  });

  it('distinguishes missing proof from proof without the required brand context', () => {
    const notes: string[] = [];

    expect(auditProofCriterion(appraisalInput({ campaignName: 'Sophia awareness' }), notes)).toBe(false);
    expect(auditProofCriterion(appraisalInput({ proofUrl: 'https://files.example/proof.png', campaignName: 'Generic awareness' }), notes)).toBe(false);
    expect(notes).toEqual([
      'Missing proof of campaign execution / invoice attachment (-25 pts).',
      'Proof attached but lacking required Sophia brand keywords (-25 pts).',
    ]);
  });

  it('treats an explicit empty proof URL as missing even when an invoice URL exists', () => {
    const notes: string[] = [];

    expect(auditProofCriterion(appraisalInput({ proofUrl: '', invoiceUrl: 'https://files.example/proof.png', campaignName: 'Sophia campaign' }), notes)).toBe(false);
    expect(notes[0]).toContain('Missing proof');
  });
});

describe('auditBudgetCriterion', () => {
  it('accepts positive requests up to the available balance, including the exact balance', () => {
    const notes: string[] = [];

    expect(auditBudgetCriterion(1, 1, notes)).toBe(true);
    expect(auditBudgetCriterion(200_000, 200_000, notes)).toBe(true);
    expect(notes[0]).toContain('requested $0.01 <= available $0.01');
  });

  it('rejects zero, negative, and over-budget requests', () => {
    const notes: string[] = [];

    expect(auditBudgetCriterion(0, 100, notes)).toBe(false);
    expect(auditBudgetCriterion(-1, 100, notes)).toBe(false);
    expect(auditBudgetCriterion(101, 100, notes)).toBe(false);
    expect(notes).toHaveLength(3);
    expect(notes[2]).toContain('requested $1.01 > available $1.00');
  });
});
