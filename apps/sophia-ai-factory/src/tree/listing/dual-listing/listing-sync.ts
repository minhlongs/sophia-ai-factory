/**
 * Dual Listing Sync & Persistence
 *
 * Implements Cloudflare D1 persistence and retrieval for filing periods.
 *
 * Layer: tree (Business Logic)
 *
 * @module tree/listing/dual-listing/listing-sync
 */

import type { D1Database } from '@cloudflare/workers-types';
import { type DualListingPeriod, rowToDualListingPeriod } from './types';

export class ListingSync {
  /**
   * Persists a Dual-Listing Period into Cloudflare D1.
   */
  public static async persistFilingPeriod(db: D1Database, period: DualListingPeriod): Promise<void> {
    await db
      .prepare(
        `INSERT OR REPLACE INTO dual_listing_periods (
          id, period_name, fiscal_year, fiscal_quarter, filing_type,
          us_cik, sgx_ticker, currency, consolidated_revenue_cents,
          consolidated_ebitda_cents, adjusted_ebitda_cents, free_cash_flow_cents,
          net_income_cents, paid_customers_count, arpu_cents, nrr_percentage,
          rule_of_forty_percentage, audit_firm_name, audit_opinion_type,
          ixbrl_document_uri, sec_edgar_submission_id, sgx_net_announcement_id,
          status, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )`
      )
      .bind(
        period.id,
        period.periodName,
        period.fiscalYear,
        period.fiscalQuarter,
        period.filingType,
        period.usCik,
        period.sgxTicker,
        period.currency,
        period.consolidatedRevenueCents,
        period.consolidatedEbitdaCents,
        period.adjustedEbitdaCents,
        period.freeCashFlowCents,
        period.netIncomeCents,
        period.paidCustomersCount,
        period.arpuCents,
        period.nrrPercentage,
        period.ruleOfFortyPercentage,
        period.auditFirmName,
        period.auditOpinionType,
        period.ixbrlDocumentUri,
        period.secEdgarSubmissionId,
        period.sgxNetAnnouncementId,
        period.status
      )
      .run();
  }

  /**
   * Loads a filing period by ID from Cloudflare D1.
   */
  public static async getFilingPeriod(db: D1Database, id: string): Promise<DualListingPeriod | null> {
    const row = await db.prepare('SELECT * FROM dual_listing_periods WHERE id = ?').bind(id).first<Record<string, unknown>>();
    return row ? rowToDualListingPeriod(row) : null;
  }
}
