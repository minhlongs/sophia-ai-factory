/**
 * fcpa-compliance-ledger.ts — Foreign Corrupt Practices Act (FCPA) & UK Bribery Act Ledger
 * Layer: TREE (Business Logic)
 *
 * Implements automated screening, anti-bribery risk scoring,
 * Merkle audit trail generation, and D1 persistence.
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  FcpaComplianceScreening,
  FcpaScreeningType,
  FcpaDisposition,
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

export class FcpaComplianceLedger {
  /**
   * Evaluates counterparty bribery risk and assigns an automated risk score and disposition.
   */
  public static evaluateRisk(input: FcpaScreeningInput): {
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

    // Determine disposition
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

  /**
   * Performs screening and returns the full FcpaComplianceScreening object.
   */
  public static conductScreening(input: FcpaScreeningInput, id?: string): FcpaComplianceScreening {
    const { riskScore, disposition, reviewNotes, immutableHash } = this.evaluateRisk(input);

    return {
      id: id || `fcpa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      filingPeriodId: input.filingPeriodId,
      counterpartyName: input.counterpartyName,
      counterpartyJurisdiction: input.counterpartyJurisdiction,
      screeningType: input.screeningType,
      riskScore,
      disposition,
      reviewedBy: 'AI_CHIEF_LEGAL_OFFICER',
      reviewNotes,
      immutableHash,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Persists an FCPA screening entry into Cloudflare D1.
   */
  public static async recordScreening(db: D1Database, screening: FcpaComplianceScreening): Promise<void> {
    await db
      .prepare(
        `INSERT INTO fcpa_compliance_screenings (
          id, filing_period_id, counterparty_name, counterparty_jurisdiction,
          screening_type, risk_score, disposition, reviewed_by, review_notes,
          immutable_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        screening.id,
        screening.filingPeriodId,
        screening.counterpartyName,
        screening.counterpartyJurisdiction,
        screening.screeningType,
        screening.riskScore,
        screening.disposition,
        screening.reviewedBy,
        screening.reviewNotes,
        screening.immutableHash,
        screening.createdAt
      )
      .run();
  }

  /**
   * Retrieves all screenings for a given filing period.
   */
  public static async getScreeningsByPeriod(db: D1Database, filingPeriodId: string): Promise<FcpaComplianceScreening[]> {
    const { results } = await db
      .prepare('SELECT * FROM fcpa_compliance_screenings WHERE filing_period_id = ? ORDER BY created_at DESC')
      .bind(filingPeriodId)
      .all<Record<string, unknown>>();

    return results.map((row) => ({
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
    }));
  }
}
