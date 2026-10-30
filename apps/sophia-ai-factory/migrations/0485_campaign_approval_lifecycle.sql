-- Campaign approval lifecycle: persist binding context so the CEO decision can be
-- re-verified server-side and continued exactly once.
--
-- Columns:
--   payload_json      canonical approval payload (script/link/jurisdiction/disclosure/budget)
--   dispatch_json     dispatch context needed to rebuild the gate continuation event
--   expires_at        approval expiry (unix ms); expired rows fail the guard
--   revoked_at/by     revocation of a granted approval (approved -> revoked)
--   executed_at       set when the gate consumes the approval into a run (approved -> executed)
--   rejection_reason  operator reason for reject/revoke (audit)
--
-- Status values in use: pending_ceo, approved, rejected, revoked, expired,
-- invalidated_by_mutation, executed, aborted_by_kill_switch.

ALTER TABLE agent_campaign_approvals ADD COLUMN payload_json TEXT;
ALTER TABLE agent_campaign_approvals ADD COLUMN dispatch_json TEXT;
ALTER TABLE agent_campaign_approvals ADD COLUMN expires_at INTEGER;
ALTER TABLE agent_campaign_approvals ADD COLUMN revoked_at INTEGER;
ALTER TABLE agent_campaign_approvals ADD COLUMN revoked_by TEXT;
ALTER TABLE agent_campaign_approvals ADD COLUMN executed_at INTEGER;
ALTER TABLE agent_campaign_approvals ADD COLUMN rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_campaign_approvals_tenant_status
  ON agent_campaign_approvals(tenant_id, status, created_at);
