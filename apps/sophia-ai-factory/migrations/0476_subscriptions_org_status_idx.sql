-- Keep org-scoped tier resolution efficient when direct user subscriptions are absent.
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status
  ON subscriptions(org_id, status);
