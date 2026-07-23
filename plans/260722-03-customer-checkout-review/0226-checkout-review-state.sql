-- 0226: add review_required to pending order status state machine
-- Safe additive: new status value + reason column + idempotent data fix
ALTER TABLE pending_orders
  ADD COLUMN review_reason TEXT;

UPDATE pending_orders
  SET status = 'pending'
  WHERE status NOT IN ('pending','paid','failed','cancelled','review_required');
