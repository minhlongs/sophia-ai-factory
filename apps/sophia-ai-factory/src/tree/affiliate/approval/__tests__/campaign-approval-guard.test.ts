/**
 * Unit Tests for Campaign Approval Integrity Guard
 *
 * @module tree/affiliate/approval/__tests__/campaign-approval-guard.test
 */

import { describe, it, expect } from 'vitest';
import {
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '@/seed/security/approval-payload-hash';
import {
  verifyCampaignApprovalIntegrity,
  type StoredCampaignApproval,
} from '../campaign-approval-guard';

describe('campaign-approval-guard', () => {
  const basePayload: CampaignApprovalPayload = {
    scriptBody: 'Comprehensive review of PartnerStack B2B SaaS workflow.',
    affiliateTargetUrl: 'https://sophia.agencyos.network/r/ps123',
    jurisdiction: 'US',
    disclosureText: '#ad #affiliate — We may earn a commission at no extra cost to you.',
    maxRenderCostCents: 20,
  };

  it('succeeds when status is approved and current payload matches stored hash', async () => {
    const hash = await computeApprovalPayloadHash(basePayload);
    const stored: StoredCampaignApproval = {
      id: 'app_1',
      tenantId: 'tenant_1',
      campaignId: 'camp_1',
      status: 'approved',
      approvalPayloadHash: hash,
      approvedBy: 'ceo_user_1',
      approvedAtMs: 1700000000000,
    };

    const res = await verifyCampaignApprovalIntegrity(stored, basePayload);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.verifiedHash).toBe(hash);
      expect(res.value.status).toBe('approved');
    }
  });

  it('auto-invalidates with APPROVAL_INVALIDATED_BY_MUTATION when payload is altered after CEO approval', async () => {
    const hash = await computeApprovalPayloadHash(basePayload);
    const stored: StoredCampaignApproval = {
      id: 'app_2',
      tenantId: 'tenant_1',
      campaignId: 'camp_2',
      status: 'approved',
      approvalPayloadHash: hash,
      approvedBy: 'ceo_user_1',
      approvedAtMs: 1700000000000,
    };

    const mutatedPayload: CampaignApprovalPayload = {
      ...basePayload,
      affiliateTargetUrl: 'https://sophia.agencyos.network/r/tampered999',
    };

    const res = await verifyCampaignApprovalIntegrity(stored, mutatedPayload);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('APPROVAL_INVALIDATED_BY_MUTATION');
      expect(res.error.nextStatus).toBe('invalidated_by_mutation');
    }
  });

  it('blocks execution when approval is still pending_ceo', async () => {
    const hash = await computeApprovalPayloadHash(basePayload);
    const stored: StoredCampaignApproval = {
      id: 'app_3',
      tenantId: 'tenant_1',
      campaignId: 'camp_3',
      status: 'pending_ceo',
      approvalPayloadHash: hash,
      approvedBy: null,
      approvedAtMs: null,
    };

    const res = await verifyCampaignApprovalIntegrity(stored, basePayload);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('APPROVAL_NOT_GRANTED');
      expect(res.error.nextStatus).toBe('pending_ceo');
    }
  });

  it('aborts immediately when workspace Kill Switch is active', async () => {
    const hash = await computeApprovalPayloadHash(basePayload);
    const stored: StoredCampaignApproval = {
      id: 'app_4',
      tenantId: 'tenant_1',
      campaignId: 'camp_4',
      status: 'approved',
      approvalPayloadHash: hash,
      approvedBy: 'ceo_user_1',
      approvedAtMs: 1700000000000,
    };

    const res = await verifyCampaignApprovalIntegrity(stored, basePayload, true);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('APPROVAL_ABORTED_BY_KILL_SWITCH');
      expect(res.error.nextStatus).toBe('aborted_by_kill_switch');
    }
  });
});
