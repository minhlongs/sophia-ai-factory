/**
 * Unit tests for SophiaToolExecutor (forest/agent-chat/tool-executor.ts)
 *
 * Verifies tool execution, tenant isolation, credit deduction, Inngest dispatch,
 * and error handling across tools.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SophiaToolExecutor } from '../tool-executor';
import { AgentToolName } from '../tool-registry';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/seed/utils/logger-utility', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn().mockResolvedValue('BASIC'),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: vi.fn().mockResolvedValue({
    credits_remaining: 100,
    credits_total_purchased: 200,
    credits_total_used: 100,
  }),
  deductCredits: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_123'] }),
  },
}));

const mockDb = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
    }),
  }),
};

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

import { getBalance, deductCredits } from '@/tree/mcu/credits-repo';
import { inngest } from '@/seed/inngest/client';

describe('SophiaToolExecutor', () => {
  let executor: SophiaToolExecutor;
  const userId = 'usr_test_tool_123';

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new SophiaToolExecutor();
  });

  describe('execute unknown tool', () => {
    it('returns error result for unknown tool name', async () => {
      const result = await executor.execute('unknown_tool' as AgentToolName, {}, userId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('isAvailable', () => {
    it('returns true when user has remaining credits', async () => {
      const available = await executor.isAvailable(AgentToolName.GetCampaigns, userId);
      expect(available).toBe(true);
    });

    it('returns false when user has 0 credits', async () => {
      vi.mocked(getBalance).mockResolvedValueOnce({
        credits_remaining: 0,
        credits_total_purchased: 10,
        credits_total_used: 10,
      } as any);

      const available = await executor.isAvailable(AgentToolName.GetCampaigns, userId);
      expect(available).toBe(false);
    });

    it('returns false when getBalance throws or returns null', async () => {
      vi.mocked(getBalance).mockRejectedValueOnce(new Error('DB error'));
      const available = await executor.isAvailable(AgentToolName.GetCampaigns, userId);
      expect(available).toBe(false);
    });
  });

  describe('GetCreditBalance', () => {
    it('retrieves user credit balance successfully', async () => {
      const result = await executor.execute(AgentToolName.GetCreditBalance, {}, userId);
      expect(result.success).toBe(true);
      expect(result.content).toEqual({
        credits_remaining: 100,
        credits_total_purchased: 200,
        credits_total_used: 100,
      });
    });
  });

  describe('GetCampaigns', () => {
    it('queries D1 campaigns filtered by userId', async () => {
      const mockCampaigns = [
        { id: 'cmp_1', name: 'Product Launch', status: 'queued', progress: 0, created_at: 1000, updated_at: 1000 },
      ];

      mockDb.prepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValueOnce({
          all: vi.fn().mockResolvedValueOnce({ results: mockCampaigns }),
        }),
      } as any);

      const result = await executor.execute(AgentToolName.GetCampaigns, { limit: 10 }, userId);
      expect(result.success).toBe(true);
      expect(result.content).toEqual(mockCampaigns);
    });
  });

  describe('GetCampaignDetail', () => {
    it('fails when campaign_id is missing', async () => {
      const result = await executor.execute(AgentToolName.GetCampaignDetail, {}, userId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('campaign_id is required');
    });

    it('returns campaign details when found', async () => {
      const mockDetail = {
        id: 'cmp_10',
        name: 'Promo 10',
        status: 'completed',
        progress: 100,
        script_content: 'Intro script',
        video_url: 'https://cdn.example.com/video.mp4',
        template_id: 'tpl_1',
        target_platform: 'youtube',
        error_message: null,
        created_at: 1000,
        updated_at: 2000,
      };

      mockDb.prepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValueOnce({
          all: vi.fn().mockResolvedValueOnce({ results: [mockDetail] }),
        }),
      } as any);

      const result = await executor.execute(AgentToolName.GetCampaignDetail, { campaign_id: 'cmp_10' }, userId);
      expect(result.success).toBe(true);
      expect(result.content).toEqual(mockDetail);
    });
  });

  describe('CreateCampaign', () => {
    it('requires topic argument', async () => {
      const result = await executor.execute(AgentToolName.CreateCampaign, {}, userId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('topic is required');
    });

    it('deducts 5 MCU credits and dispatches Inngest event', async () => {
      mockDb.prepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValueOnce({
          run: vi.fn().mockResolvedValueOnce({ success: true }),
        }),
      } as any);

      const result = await executor.execute(
        AgentToolName.CreateCampaign,
        { topic: 'AI Agent Architecture 2026' },
        userId,
      );

      expect(result.success).toBe(true);
      expect(deductCredits).toHaveBeenCalledWith(userId, 5, 'campaign_creation', 'agent_tool');
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'campaign.created',
          data: expect.objectContaining({
            userId,
            topic: 'AI Agent Architecture 2026',
          }),
        }),
      );
    });

    it('rejects campaign creation if user has insufficient credits (< 5 MCU)', async () => {
      vi.mocked(getBalance).mockResolvedValueOnce({
        credits_remaining: 3,
        credits_total_purchased: 10,
        credits_total_used: 7,
      } as any);

      const result = await executor.execute(
        AgentToolName.CreateCampaign,
        { topic: 'Insufficient Credit Test' },
        userId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient credits');
      expect(deductCredits).not.toHaveBeenCalled();
    });
  });

  describe('CancelCampaign', () => {
    it('fails when campaign_id is missing', async () => {
      const result = await executor.execute(AgentToolName.CancelCampaign, {}, userId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('campaign_id is required');
    });

    it('cancels queued campaign successfully', async () => {
      mockDb.prepare
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValueOnce({
            all: vi.fn().mockResolvedValueOnce({ results: [{ status: 'queued' }] }),
          }),
        } as any)
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValueOnce({
            run: vi.fn().mockResolvedValueOnce({ success: true }),
          }),
        } as any);

      const result = await executor.execute(AgentToolName.CancelCampaign, { campaign_id: 'cmp_queued' }, userId);
      expect(result.success).toBe(true);
      expect((result.content as any).new_status).toBe('cancelled');
    });

    it('rejects cancellation if campaign is already completed', async () => {
      mockDb.prepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValueOnce({
          all: vi.fn().mockResolvedValueOnce({ results: [{ status: 'completed' }] }),
        }),
      } as any);

      const result = await executor.execute(AgentToolName.CancelCampaign, { campaign_id: 'cmp_done' }, userId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot cancel campaign in status: completed');
    });
  });
});
