-- Durable, immutable agreement acceptance for the 14-Day Paid Pilot (Option A).
-- Strictly additive: preserves all historical orders without fabricating consent.
-- Each new offline pilot order binds user, organization, order, SKU, agreement version/hash,
-- locale, payment method, and server-side acceptance timestamp.

CREATE TABLE IF NOT EXISTS manual_pilot_terms_acceptances (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES manual_pilot_settlements(order_id),
  user_id TEXT NOT NULL CHECK(length(trim(user_id)) > 0),
  org_id TEXT NOT NULL CHECK(length(trim(org_id)) > 0),
  sku_code TEXT NOT NULL CHECK(sku_code = 'BASIC_PILOT_14D'),
  agreement_version TEXT NOT NULL CHECK(length(trim(agreement_version)) > 0),
  agreement_hash TEXT NOT NULL CHECK(length(agreement_hash) = 64),
  locale TEXT NOT NULL CHECK(locale IN ('vi', 'en')),
  accepted_at TEXT NOT NULL CHECK(length(trim(accepted_at)) > 0),
  channel TEXT NOT NULL DEFAULT 'api_checkout'
    CHECK(channel IN ('web_checkout', 'pricing_banner', 'api_checkout')),
  payment_method TEXT NOT NULL DEFAULT 'offline_bank_transfer'
    CHECK(payment_method = 'offline_bank_transfer'),
  legal_status TEXT NOT NULL DEFAULT 'pending_legal_review'
    CHECK(length(trim(legal_status)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_manual_pilot_terms_acceptances_user_org
  ON manual_pilot_terms_acceptances (user_id, org_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_pilot_terms_acceptances_version
  ON manual_pilot_terms_acceptances (agreement_version, agreement_hash);

CREATE TRIGGER IF NOT EXISTS manual_pilot_terms_acceptances_reject_mismatched_retry
BEFORE INSERT ON manual_pilot_terms_acceptances
WHEN EXISTS(
  SELECT 1 FROM manual_pilot_terms_acceptances old
  WHERE old.order_id = NEW.order_id
    AND (old.user_id <> NEW.user_id OR old.org_id <> NEW.org_id OR old.sku_code <> NEW.sku_code
      OR old.agreement_version <> NEW.agreement_version OR old.agreement_hash <> NEW.agreement_hash
      OR old.locale <> NEW.locale OR old.payment_method <> NEW.payment_method)
)
BEGIN
  SELECT RAISE(ABORT, 'pilot order acceptance does not match original consent');
END;

CREATE TRIGGER IF NOT EXISTS manual_pilot_terms_acceptances_no_replace
BEFORE INSERT ON manual_pilot_terms_acceptances
WHEN EXISTS(
  SELECT 1
  FROM manual_pilot_terms_acceptances
  WHERE id = NEW.id OR rowid = NEW.rowid OR order_id = NEW.order_id
)
BEGIN
  SELECT RAISE(ABORT, 'immutable terms acceptance');
END;

CREATE TRIGGER IF NOT EXISTS manual_pilot_terms_acceptances_no_update
BEFORE UPDATE ON manual_pilot_terms_acceptances
BEGIN
  SELECT RAISE(ABORT, 'immutable terms acceptance');
END;

CREATE TRIGGER IF NOT EXISTS manual_pilot_terms_acceptances_no_delete
BEFORE DELETE ON manual_pilot_terms_acceptances
BEGIN
  SELECT RAISE(ABORT, 'immutable terms acceptance');
END;

-- A conflicting legacy/provider order must abort the entire checkout batch before
-- settlement, audit or consent can be attached to it. Compatible retries are read-only.
CREATE TRIGGER IF NOT EXISTS manual_pilot_pending_order_reuse_guard
BEFORE INSERT ON pending_orders
WHEN NEW.period = 'pilot_14d' AND EXISTS (
  SELECT 1 FROM pending_orders WHERE order_id = NEW.order_id
) AND NOT EXISTS (
  SELECT 1 FROM pending_orders p
  JOIN manual_pilot_settlements s ON s.order_id = p.order_id
  JOIN manual_pilot_terms_acceptances a ON a.order_id = p.order_id
  JOIN manual_pilot_financial_state f ON f.order_id = p.order_id
  WHERE p.order_id = NEW.order_id AND p.user_id = NEW.user_id
    AND p.tier = NEW.tier AND p.period = NEW.period
    AND p.amount_usd_cents = NEW.amount_usd_cents
    AND p.payment_method = 'offline' AND p.invoice_url IS NULL AND p.status = 'pending'
    AND s.user_id = p.user_id AND s.org_id = a.org_id AND s.sku_code = a.sku_code
    AND s.status = 'pending_manual_payment' AND s.expected_amount_vnd = 1990000
    AND a.user_id = p.user_id AND a.payment_method = 'offline_bank_transfer'
    AND f.org_id = s.org_id AND f.state = 'PENDING_ORDER'
)
BEGIN
  SELECT RAISE(ABORT, 'incompatible pilot order requires review');
END;
