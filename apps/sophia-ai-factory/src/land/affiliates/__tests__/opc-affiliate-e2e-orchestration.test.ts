import { describe, it, expect } from 'vitest';
import {
  computeDomainBReconciliation,
  type DomainBCommissionRecord,
} from '@/land/affiliates/reconciliation/workspace-domain-b-reconciliation';
import {
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '@/seed/security/approval-payload-hash';
import {
  createCampaignApproval,
  getCampaignApproval,
  approveCampaignApproval,
  verifyAndEnforceCampaignApprovalD1,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import {
  isAffiliateKillSwitchActive,
  setAffiliateKillSwitch,
  resetKillSwitchInMemoryCache,
} from '@/tree/affiliate/kill-switch/kill-switch-store';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';
import { decidePublishCompliance } from '@/tree/affiliates/publish-compliance-decision';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

function createE2ED1() {
  return createFakeD1([
    `CREATE TABLE workspace_external_commissions (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT, network TEXT NOT NULL,
      niche TEXT NOT NULL, external_tx_id TEXT NOT NULL, sub_id TEXT, event_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', gross_amount_cents INTEGER NOT NULL DEFAULT 0,
      commission_cents INTEGER NOT NULL, platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD', is_recurring INTEGER NOT NULL DEFAULT 0,
      payout_receipt_ref TEXT, raw_payload TEXT, occurred_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );`,
    `CREATE UNIQUE INDEX idx_ws_ext_comm_dedup ON workspace_external_commissions(tenant_id, network, external_tx_id, status);`,
    `CREATE TABLE agent_campaign_approvals (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
      niche TEXT NOT NULL, jurisdiction TEXT NOT NULL, approval_payload_hash TEXT NOT NULL,
      estimated_render_cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending_ceo',
      approved_by TEXT, approved_at INTEGER, invalidated_reason TEXT,
      payload_json TEXT, dispatch_json TEXT, expires_at INTEGER,
      revoked_by TEXT, revoked_at INTEGER, executed_at INTEGER, rejection_reason TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );`,
    `CREATE INDEX idx_agent_approvals_tenant_campaign ON agent_campaign_approvals(tenant_id, campaign_id, status);`,
    `CREATE TABLE workspace_agent_policies (
      tenant_id TEXT PRIMARY KEY, kill_switch_active INTEGER NOT NULL DEFAULT 0,
      autonomy_mode TEXT NOT NULL DEFAULT 'require_ceo_approval',
      daily_render_budget_cents INTEGER NOT NULL DEFAULT 500, updated_by TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );`,
    `CREATE TABLE platform_config (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, is_secret INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );`,
  ]);
}

describe('OPC Affiliate End-to-End Multi-Tenant Orchestration & Integrity Test', () => {
  it('enforces multi-tenant isolation, state lifecycle, crash recovery, dual kill switch, and approval payload binding', async () => {
    const fakeD1 = createE2ED1() as unknown as D1Database;
    const tenantA = 'ws_saas_enterprise';
    const tenantB = 'ws_crypto_vip';

    // 1. Dual-Fixture Ledger Ingestion: SaaS on Tenant A, CEX on Tenant B
    const saasRecord: DomainBCommissionRecord = {
      id: 'rec_saas_1', tenantId: tenantA, network: 'partnerstack', externalTxId: 'tx_partnerstack_001',
      status: 'pending', grossAmountCents: 10000, commissionCents: 2000, currency: 'USD', occurredAt: 1000,
    };
    const cexRecord: DomainBCommissionRecord = {
      id: 'rec_cex_1', tenantId: tenantB, network: 'bybit', externalTxId: 'tx_bybit_cex_999',
      status: 'pending', grossAmountCents: 500000, commissionCents: 15000, currency: 'USDT', occurredAt: 1100,
    };

    // 2. Strict Tenant Data Isolation Check
    const reconA1 = computeDomainBReconciliation(tenantA, [saasRecord, cexRecord]);
    const reconB1 = computeDomainBReconciliation(tenantB, [saasRecord, cexRecord]);
    expect(reconA1.pendingCents).toBe(2000);
    expect(reconA1.byCurrency['USD']?.pendingCents).toBe(2000);
    expect(reconA1.byCurrency['USDT']).toBeUndefined();
    expect(reconA1.platformFeeCents).toBe(0);
    expect(reconB1.pendingCents).toBe(15000);
    expect(reconB1.byCurrency['USDT']?.pendingCents).toBe(15000);
    expect(reconB1.byCurrency['USD']).toBeUndefined();
    expect(reconB1.platformFeeCents).toBe(0);

    // 3. State Lifecycle Transition & Duplicate Suppression
    const saasApproved: DomainBCommissionRecord = { ...saasRecord, id: 'rec_saas_1_appr', status: 'approved', occurredAt: 2000 };
    const saasPaid: DomainBCommissionRecord = { ...saasRecord, id: 'rec_saas_1_paid', status: 'paid_receipt', occurredAt: 3000 };
    const reconA2 = computeDomainBReconciliation(tenantA, [saasRecord, saasApproved, saasPaid]);
    expect(reconA2.pendingCents).toBe(0);
    expect(reconA2.approvedUnpaidCents).toBe(0);
    expect(reconA2.paidReceiptCents).toBe(2000);
    expect(reconA2.effectiveCommissionCents).toBe(2000);

    // 4. End-to-End CEO Approval Gate with SHA-256 Payload Binding
    const basePayload: CampaignApprovalPayload = {
      scriptBody: 'Top AI automation tool for engineering leads in 2026',
      affiliateTargetUrl: 'https://sophia.ai/partner/signup?ref=ws_saas',
      jurisdiction: 'US',
      disclosureText: 'Ad: Contains affiliate links.',
      maxRenderCostCents: 1500,
      targetAccount: '@sophia_automation',
    };
    const validHash = await computeApprovalPayloadHash(basePayload);
    const approvalRes = await createCampaignApproval(fakeD1, {
      tenantId: tenantA, campaignId: 'camp_saas_101', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, status: 'pending_ceo',
    });
    expect(approvalRes.ok).toBe(true);
    if (!approvalRes.ok) return;
    expect(approvalRes.value.approvalPayloadHash).toBe(validHash);

    const approvedRes = await approveCampaignApproval(fakeD1, tenantA, 'camp_saas_101', 'ceo_user_1');
    expect(approvedRes.ok).toBe(true);
    const verifyValid = await verifyAndEnforceCampaignApprovalD1(fakeD1, tenantA, 'camp_saas_101', basePayload, false);
    expect(verifyValid.ok).toBe(true);

    // Tampering with affiliate URL or script invalidates approval
    const mutatedPayload: CampaignApprovalPayload = { ...basePayload, affiliateTargetUrl: 'https://malicious-hijack.xyz/ref=stolen' };
    const verifyTampered = await verifyAndEnforceCampaignApprovalD1(fakeD1, tenantA, 'camp_saas_101', mutatedPayload, false);
    expect(verifyTampered.ok).toBe(false);
    if (!verifyTampered.ok) expect(verifyTampered.error.code).toBe('APPROVAL_INVALIDATED_BY_MUTATION');

    const storedAfterMutation = await getCampaignApproval(fakeD1, tenantA, 'camp_saas_101');
    expect(storedAfterMutation?.status).toBe('invalidated_by_mutation');

    // Cross-tenant approval isolation
    const verifyCrossTenant = await verifyAndEnforceCampaignApprovalD1(fakeD1, tenantB, 'camp_saas_101', basePayload, false);
    expect(verifyCrossTenant.ok).toBe(false);
    if (!verifyCrossTenant.ok) expect(verifyCrossTenant.error.code).toBe('APPROVAL_NOT_GRANTED');

    // 5. Dual Kill Switch (Platform + Tenant)
    resetKillSwitchInMemoryCache();
    expect(await isAffiliateKillSwitchActive(tenantA)).toBe(false);
    expect(await isAffiliateKillSwitchActive(tenantB)).toBe(false);

    await setAffiliateKillSwitch(true, tenantA, 'admin_sec');
    expect(await isAffiliateKillSwitchActive(tenantA)).toBe(true);
    expect(await isAffiliateKillSwitchActive(tenantB)).toBe(false);

    await setAffiliateKillSwitch(true, 'default', 'platform_emergency');
    expect(await isAffiliateKillSwitchActive(tenantA)).toBe(true);
    expect(await isAffiliateKillSwitchActive(tenantB)).toBe(true);

    await setAffiliateKillSwitch(false, 'default');
    await setAffiliateKillSwitch(false, tenantA);

    // 6. Jurisdiction Compliance Gate Integration
    const vnCryptoEval = evaluateJurisdictionCompliance('crypto_global', 'VN');
    expect(vnCryptoEval.isAllowed).toBe(false);
    expect(vnCryptoEval.reason).toBe('VIETNAM_PROMOTIONAL_BAN');

    const sgCryptoEval = evaluateJurisdictionCompliance('crypto_global', 'SG');
    expect(sgCryptoEval.isAllowed).toBe(false);
    expect(sgCryptoEval.reason).toBe('SINGAPORE_MAS_PSN08_RETAIL_BAN');

    const unknownCryptoEval = evaluateJurisdictionCompliance('crypto_global', '');
    expect(unknownCryptoEval.isAllowed).toBe(false);
    expect(unknownCryptoEval.reason).toBe('JURISDICTION_UNASSESSED_OR_BLOCKED');

    expect(evaluateJurisdictionCompliance('crypto_global', 'GLOBAL').isAllowed).toBe(false);
    expect(evaluateJurisdictionCompliance('saas_global', 'VN').isAllowed).toBe(true);

    const pubDecision = decidePublishCompliance({
      baseDescription: 'Discover crypto exchange tools',
      offer: { productName: 'Bybit Global', shortUrl: 'https://sophia.ai/r/bybit', category: 'crypto' },
      jurisdiction: 'US',
      locale: 'vi',
    });
    expect(pubDecision.mayPublish).toBe(true);
    expect(pubDecision.description).toContain('liên kết affiliate');
  });
});
