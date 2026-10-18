/**
 * fcpa-risk-evaluator.ts — FCPA & UK Bribery Act risk scoring and row mapping
 * Layer: TREE (Business Logic)
 */

import { createHash } from 'node:crypto';
import type {
  FcpaComplianceScreening,
  FcpaDisposition,
  FcpaScreeningType,
} from '@/seed/types/dual-listing';

export interface FcpaScreeningInput {
  filingPeriodId: string;
  counterpartyName: string;
  counterpartyJurisdiction: string;
  screeningType: FcpaScreeningType;
  isPepInvolved?: boolean;
  isHighRiskJurisdiction?: boolean;
  unexplainedDiscountPct?: number;
}

export function evaluateFcpaRisk(input: FcpaScreeningInput): {
  riskScore: number;
  disposition: FcpaDisposition;
  reviewNotes: string;
  immutableHash: string;
} {
  let score = 10; // Baseline low risk
  const notes: string[] = [];

  if (input.isPepInvolved) {
    score += 45;
    notes.push('PEP involvement detected in beneficial ownership structure');
  }

  if (input.isHighRiskJurisdiction) {
    score += 25;
    notes.push('High-risk corruption index jurisdiction flagged (FATF / Transparency International)');
  }

  if (input.unexplainedDiscountPct && input.unexplainedDiscountPct > 20) {
    score += 30;
    notes.push(`Abnormal commission / discount rate (${input.unexplainedDiscountPct}%) flagged`);
  }

  let disposition: FcpaDisposition = 'CLEARED';
  if (score >= 80) {
    disposition = 'BLOCKED';
  } else if (score >= 50) {
    disposition = 'ESCALATED_LEGAL';
  } else if (score >= 30) {
    disposition = 'FLAGGED';
  }

  const digestPayload = `${input.filingPeriodId}:${input.counterpartyName}:${input.counterpartyJurisdiction}:${score}:${disposition}`;
  const immutableHash = createHash('sha256').update(digestPayload).digest('hex');

  return {
    riskScore: Math.min(100, score),
    disposition,
    reviewNotes: notes.length > 0 ? notes.join('; ') : 'Routine screening cleared with zero flags',
    immutableHash,
  };
}

export function mapFcpaRowToScreening(row: Record<string, unknown>): FcpaComplianceScreening {
  return {
    id: String(row.id),
    filingPeriodId: String(row.filing_period_id),
    counterpartyName: String(row.counterparty_name),
    counterpartyJurisdiction: String(row.counterparty_jurisdiction),
    screeningType: String(row.screening_type) as FcpaScreeningType,
    riskScore: Number(row.risk_score),
    disposition: String(row.disposition) as FcpaDisposition,
    reviewedBy: String(row.reviewed_by),
    reviewNotes: row.review_notes ? String(row.review_notes) : null,
    immutableHash: String(row.immutable_hash),
    createdAt: String(row.created_at),
  };
}
