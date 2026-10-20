-- Migration 0479: Affiliate Partner Risk Scoring & Canonical Partner Summary
--
-- Purpose
--   1. Per-partner fraud risk: the nightly risk job needs somewhere to record its
--      verdict so the partner portal and the payout approval queue can read the
--      same number instead of recomputing it per request. `affiliate_partners`
--      is already the single row per partner, so the score belongs there.
--   2. A canonical partner summary shape. The portal, the admin payout queue and
--      the NET-30 aggregation job each derived partner totals (earnings, pending
--      payout, referral counts, payout counts) with their own ad-hoc queries,
--      which drift apart over time. One view means every reader sees one answer.
--
-- Risk flags never act alone
--   is_suspicious is an advisory flag, not an enforcement action. A flagged
--   partner keeps earning and keeps being payable; the flag sets
--   status = 'under_review', which is a human-reviewable state. The job never
--   deletes or auto-suspends a partner — a false positive must not be able to
--   silently cut off a legitimate partner's income.
--
-- Compatibility
--   ALTER TABLE ADD COLUMN and CREATE VIEW IF NOT EXISTS only. Every added
--   column carries a default, so existing rows stay valid with no backfill.
--
-- Ordering constraint (apply-migrations.sh 'guard_add_column')
--   The pre-flight ADD COLUMN guard inspects only the table named by the FIRST
--   ALTER TABLE in a file, since SQLite has no ADD COLUMN IF NOT EXISTS. Keep
--   the affiliate_partners ALTERs above the affiliate_commissions one: the guard
--   then keys on affiliate_partners, where the risk columns are unique to this
--   migration. Reversing the order would make the guard look for the risk
--   columns on affiliate_commissions, find none, and re-run this file — which
--   would then fail on the duplicate customer_tier column.

-- =====================================================================
-- 1. affiliate_partners: risk verdict columns
-- =====================================================================

-- Composite fraud risk in 0..1, recomputed nightly by
-- forest/inngest/functions/affiliate-nightly-risk.ts. 0 means "never scored".
ALTER TABLE affiliate_partners ADD COLUMN risk_score REAL NOT NULL DEFAULT 0;

-- Millisecond timestamp of the last scoring run, or NULL when never scored.
-- Follows the epoch-millisecond convention used across the affiliate ledger.
ALTER TABLE affiliate_partners ADD COLUMN risk_checked_at INTEGER;

-- Advisory flag set when the composite score reached the suspicious threshold.
-- 0 = not flagged (default for existing rows), 1 = flagged for human review.
ALTER TABLE affiliate_partners ADD COLUMN is_suspicious INTEGER NOT NULL DEFAULT 0
  CHECK (is_suspicious IN (0, 1));

-- Supports the admin review queue: "flagged partners not yet reviewed", ordered
-- by how strongly they scored.
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_suspicious
  ON affiliate_partners(is_suspicious, risk_score DESC);

-- =====================================================================
-- 2. affiliate_commissions: which customer tier produced the commission
-- =====================================================================
--
-- Commission rate is chosen by the referred customer's tier (BASIC 30% /
-- PREMIUM 25% / ENTERPRISE 20% / MASTER 10%), not by the partner's own tier.
-- Recording the tier alongside the rate makes an old commission auditable even
-- after the rate schedule changes: commission_rate_pct can always be explained
-- by (customer_tier, rate schedule at created_at).
ALTER TABLE affiliate_commissions ADD COLUMN customer_tier TEXT;

-- =====================================================================
-- 3. affiliate_partner_summary: canonical partner totals view
-- =====================================================================
--
-- One row per partner. Earnings and pending payout come from the partner row
-- (maintained by the ledger writers), while click / referral / payout / commission
-- counts are aggregated from the event tables so they cannot drift from the
-- source of truth. COALESCE keeps partners with no activity at 0 rather than NULL,
-- so callers never need a null branch on every number.

CREATE VIEW IF NOT EXISTS affiliate_partner_summary AS
SELECT
  p.id                          AS partner_id,
  p.user_id                     AS user_id,
  p.partner_code                AS partner_code,
  p.tier                        AS partner_tier,
  p.status                      AS status,
  p.commission_rate_pct         AS commission_rate_pct,
  p.total_earnings_cents        AS total_earnings_cents,
  p.pending_payout_cents        AS pending_payout_cents,
  p.risk_score                  AS risk_score,
  p.risk_checked_at             AS risk_checked_at,
  p.is_suspicious               AS is_suspicious,
  p.tax_form_type               AS tax_form_type,
  p.tax_country                 AS tax_country,
  p.tax_form_status             AS tax_form_status,
  p.created_at                  AS created_at,
  COALESCE(clicks.click_count, 0)         AS total_clicks,
  COALESCE(refs.referral_count, 0)        AS total_referrals,
  COALESCE(refs.converted_count, 0)       AS converted_referrals,
  COALESCE(pays.payout_count, 0)          AS total_payouts,
  COALESCE(pays.settled_amount_cents, 0)  AS settled_payout_cents,
  COALESCE(comms.commission_count, 0)     AS total_commissions
FROM affiliate_partners p
LEFT JOIN (
  SELECT affiliate_partner_id, COUNT(*) AS click_count
  FROM affiliate_referral_clicks
  GROUP BY affiliate_partner_id
) clicks ON clicks.affiliate_partner_id = p.id
LEFT JOIN (
  SELECT
    partner_id,
    COUNT(*) AS referral_count,
    COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted_count
  FROM affiliate_referrals
  GROUP BY partner_id
) refs ON refs.partner_id = p.id
LEFT JOIN (
  SELECT
    partner_id,
    COUNT(*) AS payout_count,
    COALESCE(SUM(CASE WHEN status IN ('completed', 'processing') THEN amount_cents ELSE 0 END), 0) AS settled_amount_cents
  FROM affiliate_payouts
  GROUP BY partner_id
) pays ON pays.partner_id = p.id
LEFT JOIN (
  SELECT partner_id, COUNT(*) AS commission_count
  FROM affiliate_commissions
  GROUP BY partner_id
) comms ON comms.partner_id = p.id;

-- Supports the portal's "one partner at a time" lookup by code.
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_customer_tier
  ON affiliate_commissions(customer_tier);
