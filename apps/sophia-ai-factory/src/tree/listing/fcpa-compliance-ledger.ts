/**
 * fcpa-compliance-ledger.ts — Foreign Corrupt Practices Act (FCPA) & UK Bribery Act Ledger
 * Layer: TREE (Business Logic)
 *
 * Implements automated screening, anti-bribery risk scoring,
 * Merkle audit trail generation, and D1 persistence.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  FcpaComplianceScreening,
  FcpaDisposition,
} from '@/seed/types/dual-listing';
import {
  evaluateFcpaRisk,
  mapFcpaRowToScreening,
  type FcpaScreeningInput,
} from './fcpa-risk-evaluator';

export type { FcpaScreeningInput };

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
    return evaluateFcpaRisk(input);
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

    return results.map(mapFcpaRowToScreening);
  }
}
