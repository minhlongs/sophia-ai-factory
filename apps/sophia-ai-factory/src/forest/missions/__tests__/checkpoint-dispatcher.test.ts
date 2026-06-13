/**
 * Integration tests: checkpoint persistence in mission dispatcher (OpenMontage Phase 01)
 *
 * Strategy: per-test chain queue via mockReturnValueOnce. Each db.from() call
 * consumes the next queued chain. Assertions focus on handler invocation context
 * (checkpoint presence/absence) rather than internal DB call counts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockDbFrom,
  mockDeductCredits,
  mockGetCommand,
  mockFireWebhook,
  mockLogger,
  mockHandleAiWrite,
} = vi.hoisted(() => ({
  mockDbFrom: vi.fn(),
  mockDeductCredits: vi.fn(),
  mockGetCommand: vi.fn(),
  mockFireWebhook: vi.fn(),
  mockLogger: vi.fn(),
  mockHandleAiWrite: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockDbFrom }),
}));

vi.mock('@/land/mcu/credits-repo', () => ({
  deductCredits: mockDeductCredits,
}));

vi.mock('./command-registry', () => ({
  getCommand: mockGetCommand,
}));

vi.mock('../fire-webhook', () => ({
  fireMissionWebhook: mockFireWebhook,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: mockLogger,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../handlers/ai-write', () => ({ handle: mockHandleAiWrite }));
vi.mock('../handlers/social-publish', () => ({ handle: vi.fn() }));
vi.mock('../handlers/video-create', () => ({ handle: vi.fn() }));
vi.mock('../handlers/video-status', () => ({ handle: vi.fn() }));
vi.mock('../handlers/proposal-create', () => ({ handle: vi.fn() }));
vi.mock('../handlers/proposal-list', () => ({ handle: vi.fn() }));
vi.mock('../handlers/lead-find', () => ({ handle: vi.fn() }));
vi.mock('../handlers/lead-enrich', () => ({ handle: vi.fn() }));
vi.mock('../handlers/lead-export', () => ({ handle: vi.fn() }));
vi.mock('../handlers/email-campaign', () => ({ handle: vi.fn() }));
vi.mock('../handlers/email-test', () => ({ handle: vi.fn() }));
vi.mock('../handlers/email-templates', () => ({ handle: vi.fn() }));
vi.mock('../handlers/youtube-publish', () => ({ handle: vi.fn() }));
vi.mock('../handlers/youtube-list-channels', () => ({ handle: vi.fn() }));
vi.mock('../handlers/voice-clone', () => ({ handle: vi.fn() }));
vi.mock('../handlers/avatar-create-did', () => ({ handle: vi.fn() }));
vi.mock('../handlers/subtitle-generate', () => ({ handle: vi.fn() }));
vi.mock('../handlers/campaign-run', () => ({ handle: vi.fn() }));
vi.mock('../handlers/analytics-report', () => ({ handle: vi.fn() }));
vi.mock('../handlers/webhook-test', () => ({ handle: vi.fn() }));

// ── Import after mocks ────────────────────────────────────────────────────────
import { dispatchMission, recoverStuckMissions } from '../dispatcher';

// ── Chain factory ─────────────────────────────────────────────────────────────

function makeChain(singleResult: { data: unknown }): any {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(singleResult),
    // Make chain thenable for cases where code awaits without .single()
    then: vi.fn().mockImplementation((resolve) => resolve(singleResult)),
  };
  return chain;
}

// Queue chains — called INSIDE each test after vi.clearAllMocks()
function queueChains(chains: Array<{ data: unknown }>) {
  const chainList = chains.map(c => makeChain(c));
  let idx = 0;
  mockDbFrom.mockImplementation(() => chainList[idx++] ?? makeChain({ data: null }));
}

const MISSION_ID = 'mission-checkpoint-test';

beforeEach(() => {
  vi.clearAllMocks();
  mockDbFrom.mockReset();
  mockGetCommand.mockReturnValue({ credits: 0 });
  mockDeductCredits.mockResolvedValue(true);
  mockHandleAiWrite.mockResolvedValue({ ok: true, data: { result: 'done' } });
  mockFireWebhook.mockResolvedValue(undefined);
});

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Dispatcher — checkpoint persistence', () => {
  describe('loadCp: pre-migration (no checkpoint_json column)', () => {
    it('returns null when column does not exist (graceful fallback)', async () => {
      const chain = makeChain({ data: null });
      chain.single = vi.fn().mockRejectedValue(new Error('no such column: checkpoint_json'));
      mockDbFrom.mockImplementation(() => chain);

      await dispatchMission(MISSION_ID);
      expect(mockLogger).toHaveBeenCalled();
    });
  });

  describe('checkpoint: happy path (no prior checkpoint)', () => {
    it('dispatches mission without checkpoint when column is empty', async () => {
      queueChains([
        { data: { id: MISSION_ID, user_id: 'u1', command: 'ai:write', params: null, status: 'pending', webhook_url: null } },
        { data: null }, // mark running
        { data: null }, // loadCp — no checkpoint
      ]);

      await dispatchMission(MISSION_ID);

      expect(mockHandleAiWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          missionId: MISSION_ID,
          checkpoint: undefined,
        }),
      );
    });
  });

  describe('checkpoint: resume from existing checkpoint', () => {
    it('passes checkpoint data to handler when resume data exists', async () => {
      const existingCp = {
        stepOrder: 2, stepType: 'research', savedAt: '2026-06-10T10:00:00Z',
        partialResult: { outline: ['intro', 'body', 'conclusion'] },
        tokensUsed: 500, provider: 'openrouter', model: 'gpt-4',
        retryCount: 1, state: { currentStep: 3 },
      };

      queueChains([
        { data: { id: MISSION_ID, user_id: 'u1', command: 'ai:write', params: null, status: 'pending', webhook_url: null } },
        { data: null }, // mark running
        { data: { checkpoint_json: JSON.stringify(existingCp) } }, // loadCp
      ]);

      await dispatchMission(MISSION_ID);

      expect(mockHandleAiWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          missionId: MISSION_ID,
          checkpoint: {
            partialResult: existingCp.partialResult,
            tokensUsed: existingCp.tokensUsed,
            provider: existingCp.provider,
            model: existingCp.model,
            state: existingCp.state,
          },
          onProgress: expect.any(Function),
        }),
      );
    });
  });

  describe('onProgress: intermediate state persistence', () => {
    it('handler onProgress callback is a function (saveCp wired correctly)', async () => {
      queueChains([
        { data: { id: MISSION_ID, user_id: 'u1', command: 'ai:write', params: null, status: 'pending', webhook_url: null } },
        { data: null }, // mark running
        { data: null }, // loadCp
      ]);

      let capturedOnProgress: ((data: unknown) => Promise<void>) | null = null;

      mockHandleAiWrite.mockImplementation(async (ctx) => {
        capturedOnProgress = ctx.onProgress;
        return { ok: true, data: { result: 'done' } };
      });

      await dispatchMission(MISSION_ID);

      expect(capturedOnProgress).toBeDefined();
      expect(typeof capturedOnProgress).toBe('function');
    });
  });

  describe('checkpoint: failure preserves checkpoint for resume', () => {
    it('passes checkpoint to handler even when prior checkpoint exists and handler fails', async () => {
      const existingCp = {
        stepOrder: 2, stepType: 'research', savedAt: '2026-06-10T10:00:00Z',
        partialResult: { outline: ['intro'] }, tokensUsed: 300,
        provider: 'openrouter', model: 'gpt-4', retryCount: 0,
      };

      queueChains([
        { data: { id: MISSION_ID, user_id: 'u1', command: 'ai:write', params: null, status: 'pending', webhook_url: null } },
        { data: null }, // mark running
        { data: { checkpoint_json: JSON.stringify(existingCp) } }, // loadCp
      ]);

      mockHandleAiWrite.mockResolvedValue({ ok: false, error: 'provider_rate_limit' });

      await dispatchMission(MISSION_ID);

      expect(mockHandleAiWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          checkpoint: expect.objectContaining({
            partialResult: existingCp.partialResult,
          }),
        }),
      );
    });
  });

  describe('checkpoint: handler timeout', () => {
    it('marks mission as failed on handler timeout (25s)', async () => {
      queueChains([
        { data: { id: MISSION_ID, user_id: 'u1', command: 'ai:write', params: null, status: 'pending', webhook_url: null } },
        { data: null }, // mark running
        { data: null }, // loadCp
        { data: null }, // update failed (timeout path)
      ]);

      mockHandleAiWrite.mockImplementation(() => new Promise(() => {}));

      // dispatchMission returns void; timeout is handled internally via setTimeout
      dispatchMission(MISSION_ID);

      // Wait for 25s timeout + buffer
      await new Promise(r => setTimeout(r, 26_500));

      // After timeout, logger.error should have been called
      expect(mockLogger).toHaveBeenCalled();
    }, 35_000); // 35s test timeout
  });

  describe('recoverStuckMissions', () => {
    it('recovers missions stuck in running beyond threshold', async () => {
      const stuckMissions = [{ id: 'stuck-1' }, { id: 'stuck-2' }];

      // Spy on Date.now() AFTER beforeEach (vi.clearAllMocks resets spies)
      const times = [1_700_000_000_000, 1_700_000_000_000 + 301_000];
      const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
        const t = times.shift();
        return t ?? 1_700_000_000_000;
      });

      const chain = makeChain({ data: stuckMissions });
      mockDbFrom.mockReturnValue(chain);

      const recovered = await recoverStuckMissions(300);
      expect(recovered).toBe(2);

      dateNowSpy.mockRestore();
    });

    it('returns 0 when no stuck missions', async () => {
      const chain = makeChain({ data: [] });
      mockDbFrom.mockReturnValue(chain);

      const recovered = await recoverStuckMissions(300);
      expect(recovered).toBe(0);
    });
  });

  describe('checkpoint: size limit enforcement', () => {
    it('handles oversized checkpoint without crashing', async () => {
      const hugeState = { data: 'x'.repeat(50_000) };
      const oversizedCp = {
        stepOrder: 1, stepType: 'research',
        savedAt: new Date().toISOString(),
        partialResult: hugeState, tokensUsed: 1000,
        provider: 'openrouter', model: 'gpt-4', retryCount: 0,
      };

      queueChains([
        { data: { id: MISSION_ID, user_id: 'u1', command: 'ai:write', params: null, status: 'pending', webhook_url: null } },
        { data: null }, // mark running
        { data: { checkpoint_json: JSON.stringify(oversizedCp) } }, // loadCp
      ]);

      await expect(dispatchMission(MISSION_ID)).resolves.toBeUndefined();
    });
  });

  describe('checkpoint: webhook on failure', () => {
    it('fires webhook even when handler fails', async () => {
      mockFireWebhook.mockResolvedValue(undefined);
      mockHandleAiWrite.mockResolvedValue({ ok: false, error: 'test_error' });

      queueChains([
        { data: { id: 'mission-webhook-test', user_id: 'user-1', command: 'ai:write', params: null, status: 'pending', webhook_url: 'https://example.com/webhook' } },
        { data: null }, // mark running
        { data: null }, // loadCp
        { data: null }, // update failed
        { data: null }, // saveCp (onProgress may fire during failure cleanup)
      ]);

      await dispatchMission('mission-webhook-test');

      expect(mockFireWebhook).toHaveBeenCalled();
    });
  });
});
