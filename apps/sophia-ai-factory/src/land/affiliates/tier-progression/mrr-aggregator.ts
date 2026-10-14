import { logger } from '@/seed/utils/logger-utility';

/**
 * Calculate an affiliate partner's activated monthly recurring revenue (MRR) in cents.
 * Aggregates verified active customer subscriptions and 30-day conversion volume from D1.
 */
export async function calculateMrrForAffiliate(
  d1: D1Database,
  affiliateIdOrCode: string
): Promise<number> {
  try {
    // 1. Check partner record
    const partnerStmt = d1.prepare(`
      SELECT id, partner_code, activated_mrr_cents
      FROM affiliate_partners
      WHERE id = ? OR partner_code = ?
      LIMIT 1
    `);
    const partner = await partnerStmt.bind(affiliateIdOrCode, affiliateIdOrCode).first<{
      id: string;
      partner_code: string;
      activated_mrr_cents: number | null;
    }>();

    if (!partner) {
      return 0;
    }

    const partnerId = partner.id;

    // 2. Query verified active subscriptions or recurring 30-day revenue from commission ledger
    const thirtyDaysAgoMs = Date.now() - 30 * 86400 * 1000;
    const ledgerStmt = d1.prepare(`
      SELECT COALESCE(SUM(gross_cents), 0) as recent_mrr
      FROM commission_ledger
      WHERE affiliate_id = ?
        AND status IN ('payable', 'paid', 'pending')
        AND created_at >= ?
    `);
    const ledgerRow = await ledgerStmt.bind(partnerId, thirtyDaysAgoMs).first<{ recent_mrr: number }>();
    const ledgerMrr = ledgerRow?.recent_mrr ? Number(ledgerRow.recent_mrr) : 0;

    // 3. Query explicitly recorded activated MRR
    const storedMrr = partner.activated_mrr_cents ? Number(partner.activated_mrr_cents) : 0;

    // Return the maximum verified active MRR representation
    return Math.max(ledgerMrr, storedMrr);
  } catch (error) {
    logger.warn('[tier-progression-engine] Failed to calculate MRR from D1, falling back to 0', {
      affiliateIdOrCode,
      error: String(error),
    });
    return 0;
  }
}
