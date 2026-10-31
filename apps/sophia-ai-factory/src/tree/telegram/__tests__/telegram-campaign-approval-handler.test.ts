import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendCampaignApprovalNotification,
  handleTelegramCampaignApprovalCallback,
} from '../telegram-campaign-approval-handler';
import * as utils from '../handlers/utils';
import * as userMappings from '../user-mappings-service';
import * as approvalRepo from '@/tree/affiliate/approval/campaign-approval-repo';
import * as approvalContinuation from '@/tree/affiliate/approval/approval-continuation';
import * as workspaceAccess from '@/seed/auth/workspace-access';
import * as dbClient from '@/seed/db/client';

describe('Telegram Campaign Approval Handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sendCampaignApprovalNotification formats message and sends with inline keyboard', async () => {
    const sendKeyboardSpy = vi
      .spyOn(utils, 'sendMessageWithKeyboard')
      .mockResolvedValueOnce();

    const mockApproval = {
      id: 'appr_01',
      tenantId: 'tenant_alpha',
      campaignId: 'camp_saas_01',
      niche: 'saas_global',
      jurisdiction: 'US',
      status: 'pending_ceo' as const,
      approvalPayloadHash: 'hash_123',
      approvedBy: null,
      approvedAtMs: null,
    };

    const res = await sendCampaignApprovalNotification({
      chatId: '12345678',
      approval: mockApproval,
      productName: 'Cursor AI Enterprise',
      budgetUsd: 15.5,
      locale: 'vi',
    });

    expect(res).toBe(true);
    expect(sendKeyboardSpy).toHaveBeenCalledWith(
      '12345678',
      expect.stringContaining('YÊU CẦU PHÊ DUYỆT CHIẾN DỊCH AFFILIATE'),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ callback_data: 'capprove:appr_01' }),
            expect.objectContaining({ callback_data: 'creject:appr_01' }),
          ]),
        ]),
      }),
    );
  });

  it('handleTelegramCampaignApprovalCallback rejects unlinked telegram user', async () => {
    vi.spyOn(userMappings, 'getUserByChatId').mockResolvedValueOnce(null);
    const sendMsgSpy = vi.spyOn(utils, 'sendMessage').mockResolvedValueOnce();

    const result = await handleTelegramCampaignApprovalCallback('chat_999', 'capprove:appr_01');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Unlinked telegram user');
    expect(sendMsgSpy).toHaveBeenCalledWith(
      'chat_999',
      expect.stringContaining('chưa được liên kết'),
    );
  });

  it('handleTelegramCampaignApprovalCallback blocks cross-tenant IDOR attempt', async () => {
    vi.spyOn(userMappings, 'getUserByChatId').mockResolvedValueOnce('user_hacker');

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            tenant_id: 'victim_tenant',
            campaign_id: 'victim_camp',
            status: 'pending_ceo',
          }),
        }),
      }),
    };
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);
    vi.spyOn(workspaceAccess, 'getUserWorkspaceIds').mockResolvedValueOnce(['hacker_tenant_only']);
    const sendMsgSpy = vi.spyOn(utils, 'sendMessage').mockResolvedValueOnce();

    const result = await handleTelegramCampaignApprovalCallback('chat_hacker', 'capprove:appr_victim');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Cross-tenant access or non-admin forbidden');
    expect(sendMsgSpy).toHaveBeenCalledWith(
      'chat_hacker',
      expect.stringContaining('Bạn không có quyền quản trị viên'),
    );
  });

  it('handleTelegramCampaignApprovalCallback blocks tenant member without ADMIN role (F-01)', async () => {
    vi.spyOn(userMappings, 'getUserByChatId').mockResolvedValueOnce('user_member');

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            tenant_id: 'target_tenant',
            campaign_id: 'camp_01',
            status: 'pending_ceo',
          }),
        }),
      }),
    };
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);
    vi.spyOn(workspaceAccess, 'getUserWorkspaceIds').mockResolvedValueOnce(['target_tenant']);
    // Member exists, but role is MEMBER, not ADMIN
    vi.spyOn(workspaceAccess, 'hasWorkspaceRole').mockResolvedValueOnce(false);
    const sendMsgSpy = vi.spyOn(utils, 'sendMessage').mockResolvedValueOnce();

    const result = await handleTelegramCampaignApprovalCallback('chat_member', 'capprove:appr_01');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Cross-tenant access or non-admin forbidden');
    expect(sendMsgSpy).toHaveBeenCalledWith(
      'chat_member',
      expect.stringContaining('Bạn không có quyền quản trị viên (ADMIN)'),
    );
  });

  it('handleTelegramCampaignApprovalCallback successfully approves and triggers continuation (F-02)', async () => {
    vi.spyOn(userMappings, 'getUserByChatId').mockResolvedValueOnce('user_ceo');

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            tenant_id: 'my_tenant',
            campaign_id: 'camp_alpha',
            status: 'pending_ceo',
          }),
        }),
      }),
    };
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);
    vi.spyOn(workspaceAccess, 'getUserWorkspaceIds').mockResolvedValueOnce(['my_tenant']);
    vi.spyOn(workspaceAccess, 'hasWorkspaceRole').mockResolvedValueOnce(true);

    const casSpy = vi.spyOn(approvalRepo, 'approveCampaignApprovalCAS').mockResolvedValueOnce({
      ok: true,
      value: {
        id: 'appr_valid',
        tenantId: 'my_tenant',
        campaignId: 'camp_alpha',
        status: 'approved' as const,
        approvalPayloadHash: 'hash',
        approvedBy: 'telegram:chat_ceo:user_ceo',
        approvedAtMs: Date.now(),
      },
    });

    const continuationSpy = vi
      .spyOn(approvalContinuation, 'sendApprovalContinuation')
      .mockResolvedValueOnce({ ok: true });

    const sendMsgSpy = vi.spyOn(utils, 'sendMessage').mockResolvedValueOnce();

    const result = await handleTelegramCampaignApprovalCallback('chat_ceo', 'capprove:appr_valid');

    expect(result.ok).toBe(true);
    expect(casSpy).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tenantId: 'my_tenant',
        approvalId: 'appr_valid',
      }),
    );
    expect(continuationSpy).toHaveBeenCalledWith(
      mockDb,
      'my_tenant',
      expect.objectContaining({ id: 'appr_valid' }),
    );
    expect(sendMsgSpy).toHaveBeenCalledWith(
      'chat_ceo',
      expect.stringContaining('ĐÃ PHÊ DUYỆT THÀNH CÔNG'),
    );
  });

  it('handleTelegramCampaignApprovalCallback notifies if already approved on Web (conflict)', async () => {
    vi.spyOn(userMappings, 'getUserByChatId').mockResolvedValueOnce('user_ceo');

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            tenant_id: 'my_tenant',
            campaign_id: 'camp_alpha',
            status: 'approved',
          }),
        }),
      }),
    };
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);
    vi.spyOn(workspaceAccess, 'getUserWorkspaceIds').mockResolvedValueOnce(['my_tenant']);
    vi.spyOn(workspaceAccess, 'hasWorkspaceRole').mockResolvedValueOnce(true);

    vi.spyOn(approvalRepo, 'approveCampaignApprovalCAS').mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'APPROVAL_STATE_CONFLICT',
        message: 'Approval appr_conflict is approved, not pending',
      },
    });

    const sendMsgSpy = vi.spyOn(utils, 'sendMessage').mockResolvedValueOnce();

    const result = await handleTelegramCampaignApprovalCallback('chat_ceo', 'capprove:appr_conflict');

    expect(result.ok).toBe(false);
    expect(sendMsgSpy).toHaveBeenCalledWith(
      'chat_ceo',
      expect.stringContaining('Chiến dịch này đã được xử lý trước đó'),
    );
  });
});
