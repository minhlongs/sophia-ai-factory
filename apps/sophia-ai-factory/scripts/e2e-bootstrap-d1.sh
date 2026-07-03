#!/usr/bin/env bash
# e2e-bootstrap-d1.sh — Apply missing migrations to local D1 for E2E testing.
#
# wrangler's built-in migration tracker stops at 0148 due to numbering gaps
# (e.g., 0148 → 0160, skipping 0149-0159). This script runs the remaining
# migrations (0160+) directly against the local D1 database.
#
# Safe to run repeatedly — all statements use CREATE TABLE IF NOT EXISTS
# or similar idempotent patterns.
#
# Usage:
#   bash scripts/e2e-bootstrap-d1.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🧪 Bootstrapping local D1 for E2E tests..."
echo ""

# Migrations that wrangler's sequential tracker may have missed
# These use IF NOT EXISTS / idempotent patterns
MISSING_MIGRATIONS=(
  migrations/0160-canonical-sop-executions.sql
  migrations/0170-immutable-audit-triggers.sql
  migrations/0171_scheduled_campaigns.sql
  migrations/0173-cash-payment-columns.sql
  migrations/0174-add-composite-indexes.sql
  migrations/0175-query-performance-indexes.sql
  migrations/0176_credit_usage_monthly.sql
  migrations/0177_batch_jobs_fanout_dedup.sql
  migrations/0178_idempotency_keys.sql
  migrations/0178_referral_rewards_table.sql
  migrations/0179_batch_jobs_idempotency_unique.sql
  migrations/0179_referral_rewards_table.sql
  migrations/0180_fix_campaign_checkpoints_columns.sql
  migrations/0181_engine_missions_checkpoint.sql
  migrations/0182_org_quota_overrides.sql
  migrations/0183_raas_audit_logs_hash_chain.sql
  migrations/0184_key_versions.sql
  migrations/0185_deploy_guard_approvals.sql
  migrations/0186_add_diff_fields.sql
  migrations/0187_add_provider_payment_id_to_pending_orders.sql
  migrations/0200-memory-consolidation-functions.sql
  migrations/0201-memory-consolidation.sql
  migrations/0202_pipeline_checkpoints.sql
  migrations/0203_payment_events_dropped.sql
  migrations/0206_commission_events.sql
  migrations/0207_overage_topup.sql
  migrations/0208_refund_events_and_ledger.sql
  migrations/0209_landing_pages.sql
  migrations/0210_relax_audit_logs_action_check.sql
  migrations/0211_platform_configs.sql
)

for mig in "${MISSING_MIGRATIONS[@]}"; do
  if [ -f "$mig" ]; then
    echo "  ➜ Applying $(basename "$mig")..."
    npx wrangler d1 execute sophia-raas-db --local --file="$mig" 2>/dev/null
  fi
done

echo ""
echo "✅ Local D1 bootstrap complete"
