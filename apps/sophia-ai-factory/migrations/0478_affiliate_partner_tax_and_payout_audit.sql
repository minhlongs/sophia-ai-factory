-- Migration 0478: Affiliate Partner Tax Form Record & Payout Approval Audit
--
-- Purpose
--   1. Partner-side tax documentation: cross-border affiliate payouts must be
--      backed by a tax form that matches the partner's tax residency (W-9 for
--      US persons, W-8BEN for non-US persons, local declaration where the
--      partner's country issues its own). Without it a payout cannot be
--      approved lawfully, so the form type and its verification state must be
--      recorded per partner.
--   2. A payout approval decision trail. `affiliate_payouts` already carries
--      `version`, `approved_by` and `approved_at` (migration 0452), which are
--      actively maintained by the OCC payout lifecycle. What is missing is the
--      *reason* an approval or rejection was granted — the human decision is
--      otherwise unrecoverable from the row, and an auditor cannot distinguish
--      "approved because a valid tax form was on file" from "approved with no
--      form at all".
--
-- Deliberately NOT stored
--   Tax identification numbers, passport numbers and street addresses. Only the
--   form *type*, the form's *status*, and the residency country are persisted.
--   The document itself stays with the partner; the platform records that it
--   was supplied and verified.
--
-- Compatibility
--   ALTER TABLE ADD COLUMN and CREATE TABLE IF NOT EXISTS only. Every added
--   column has a default, so existing rows are valid without a backfill.

-- =====================================================================
-- 1. affiliate_partners: tax documentation per partner
-- =====================================================================

-- Form type the partner's tax residency requires. 'unknown' is the honest
-- default for a partner who has not declared a country yet, and it is treated
-- as "not eligible for payout" rather than as a permissive US default.
ALTER TABLE affiliate_partners ADD COLUMN tax_form_type TEXT NOT NULL DEFAULT 'unknown'
  CHECK (tax_form_type IN ('w9', 'w8ben', 'local_declaration', 'unknown'));

-- ISO-3166-1 alpha-2 country the tax form was issued under. Drives which form
-- type is required; 'unknown' means the partner has not declared residency.
ALTER TABLE affiliate_partners ADD COLUMN tax_country TEXT NOT NULL DEFAULT 'unknown';

-- Whether a signed form has actually been supplied and checked:
--   'not_submitted'          — no form on file (default for existing rows)
--   'pending_verification'   — form uploaded, awaiting manual/automated check
--   'verified'               — form checked and accepted; payout may proceed
--   'rejected'               — form supplied but unacceptable (wrong form type,
--                             expired, illegible); payout is held
--   'expired'                — form was valid but its validity window lapsed
ALTER TABLE affiliate_partners ADD COLUMN tax_form_status TEXT NOT NULL DEFAULT 'not_submitted'
  CHECK (tax_form_status IN ('not_submitted', 'pending_verification', 'verified', 'rejected', 'expired'));

-- Millisecond timestamp the form was accepted, or NULL when never verified.
-- Mirrors the epoch-millisecond convention used across the affiliate ledger.
ALTER TABLE affiliate_partners ADD COLUMN tax_form_verified_at INTEGER;

-- Version of the form template/rule set the partner signed against. Keeps the
-- record meaningful if the required form set changes later.
ALTER TABLE affiliate_partners ADD COLUMN tax_form_version TEXT;

-- Supports "which partners are payout-blocked pending tax paperwork" queries.
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_tax_status
  ON affiliate_partners(tax_form_status, tax_country);

-- =====================================================================
-- 2. affiliate_payout_approvals: immutable decision trail
-- =====================================================================
--
-- One row per approve/reject decision. `affiliate_payouts.version` is bumped
-- by the OCC writer on every transition, so (payout_id, version) is the
-- natural key and a decision cannot be silently overwritten by a later bump.

CREATE TABLE IF NOT EXISTS affiliate_payout_approvals (
  id TEXT PRIMARY KEY,
  payout_id TEXT NOT NULL REFERENCES affiliate_payouts(id),
  -- OCC version the payout was at when this decision was made.
  payout_version INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_by TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  reason TEXT,
  -- Human-readable note by the approver. Optional but expected on rejection.
  note TEXT,
  -- Tax form state that was on file for the partner at decision time.
  -- Recorded as evidence the payout was lawful when approved, not as a
  -- duplicate of affiliate_partners (which mutates; this snapshot does not).
  tax_form_type TEXT,
  tax_form_status TEXT,
  -- Money released by this decision, in the payout's currency. Denormalised
  -- so an auditor can total approved amounts without joining the payout row.
  amount_cents INTEGER,
  currency TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aff_payout_approvals_payout_version
  ON affiliate_payout_approvals(payout_id, payout_version);
CREATE INDEX IF NOT EXISTS idx_aff_payout_approvals_decision
  ON affiliate_payout_approvals(decision, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_payout_approvals_decider
  ON affiliate_payout_approvals(decided_by, decided_at DESC);
