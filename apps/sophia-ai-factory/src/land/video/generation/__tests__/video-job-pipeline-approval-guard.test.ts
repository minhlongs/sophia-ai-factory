import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createVideoJob,
  CampaignApprovalRequiredError,
} from '../video-job-pipeline';
import * as costGuardrail from '../../templates/cost-guardrail';
import * as dbClient from '@/seed/db/client';
import * as inngestClient from '@/seed/inngest/client';
import * as killSwitchStore from '@/tree/affiliate/kill-switch/kill-switch-store';
import * as approvalRepo from '@/tree/affiliate/approval/campaign-approval-repo';

describe('Video Job Pipeline Zero-Bypass Approval Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(costGuardrail, 'checkVideoBudget').mockResolvedValue({
      allowed: true,
      estimatedCostUsd: 0.1,
      estimatedCredits: 10,
      creditsRemaining: 100,
    });
    vi.spyOn(inngestClient.inngest, 'send').mockResolvedValue({ ids: ['evt_1'] });
  });

  it('allows non-campaign video jobs without approval checks', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    } as unknown as ReturnType<typeof dbClient.createServerClient>);

    const res = await createVideoJob({
      tenantId: 'tenant_1',
      userId: 'user_1',
      prompt: 'A scenic video',
      tier: 'BASIC',
    });

    expect(res.status).toBe('queued');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        prompt: 'A scenic video',
      }),
    );
  });

  it('rejects campaign video job when approvalPayload is missing', async () => {
    await expect(
      createVideoJob({
        tenantId: 'tenant_1',
        userId: 'user_1',
        prompt: 'Promote SaaS tool',
        tier: 'BASIC',
        campaignId: 'camp_affiliate_01',
      }),
    ).rejects.toThrow(CampaignApprovalRequiredError);
  });

  it('rejects campaign video job when approval verification fails', async () => {
    const mockD1 = {} as D1Database;
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockD1);
    vi.spyOn(killSwitchStore, 'getAffiliateKillSwitchState').mockResolvedValue({
      active: false,
      known: true,
    });

    vi.spyOn(approvalRepo, 'verifyAndEnforceCampaignApprovalD1').mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'APPROVAL_INVALIDATED_BY_MUTATION',
        message: 'Payload hash does not match approved hash',
        nextStatus: 'invalidated_by_mutation',
        computedHash: 'hash_mutated',
      },
    });

    await expect(
      createVideoJob({
        tenantId: 'tenant_1',
        userId: 'user_1',
        prompt: 'Promote SaaS tool',
        tier: 'BASIC',
        campaignId: 'camp_affiliate_01',
        approvalPayload: {
          scriptBody: 'Mutated script that was not approved',
          affiliateTargetUrl: 'https://evil.com',
          jurisdiction: 'US',
          disclosureText: '#ad',
          targetAccount: 'acct_1',
          maxRenderCostCents: 1000,
        },
      }),
    ).rejects.toThrow('Payload hash does not match approved hash');
  });

  it('allows campaign video job when approval verification succeeds', async () => {
    const mockD1 = {} as D1Database;
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockD1);
    vi.spyOn(killSwitchStore, 'getAffiliateKillSwitchState').mockResolvedValue({
      active: false,
      known: true,
    });

    vi.spyOn(approvalRepo, 'verifyAndEnforceCampaignApprovalD1').mockResolvedValueOnce({
      ok: true,
      value: {
        approvalId: 'appr_valid_01',
        campaignId: 'camp_affiliate_01',
        verifiedHash: 'hash_match',
        status: 'approved',
      },
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(dbClient, 'createServerClient').mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    } as unknown as ReturnType<typeof dbClient.createServerClient>);

    const res = await createVideoJob({
      tenantId: 'tenant_1',
      userId: 'user_1',
      prompt: 'Promote SaaS tool',
      tier: 'BASIC',
      campaignId: 'camp_affiliate_01',
      approvalPayload: {
        scriptBody: 'Original verified script',
        affiliateTargetUrl: 'https://tool.com?aff=sophiatest',
        jurisdiction: 'US',
        disclosureText: '#affiliate',
        targetAccount: 'acct_1',
        maxRenderCostCents: 1000,
      },
    });

    expect(res.status).toBe('queued');
    expect(mockInsert).toHaveBeenCalled();
  });
});
