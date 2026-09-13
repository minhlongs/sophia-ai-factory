/**
 * Unit tests for correctCreativeMemory server action.
 *
 * Covers: auth gate, validation, workspace lookup, canonical workspace access (FORBIDDEN),
 * memory not found, store put failure, non-fatal event emission, and happy path.
 *
 * @module land/creative-memory/__tests__/actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CreativeMemory } from '@/seed/types/creative-domain';
import { success, failure } from '@/seed/types/result';

const { mockPrepare, mockBind, mockFirst, fakeD1, mockStoreGet, mockStorePut, mockEmitMemoryCorrected } =
  vi.hoisted(() => {
    const mockPrepare = vi.fn().mockReturnThis();
    const mockBind = vi.fn().mockReturnThis();
    const mockFirst = vi.fn();
    const fakeD1 = {
      prepare: mockPrepare,
      bind: mockBind,
      first: mockFirst,
    };
    const mockStoreGet = vi.fn();
    const mockStorePut = vi.fn();
    const mockEmitMemoryCorrected = vi.fn();

    return {
      mockPrepare,
      mockBind,
      mockFirst,
      fakeD1,
      mockStoreGet,
      mockStorePut,
      mockEmitMemoryCorrected,
    };
  });

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue(fakeD1),
  createServerClient: vi.fn().mockReturnValue(fakeD1),
}));

vi.mock('@/tree/creative-memory/creative-memory-store', () => ({
  creativeMemoryStore: {
    get: (...args: unknown[]) => mockStoreGet(...args),
    put: (...args: unknown[]) => mockStorePut(...args),
  },
}));

vi.mock('@/tree/performance/loop-emitters-cost', () => ({
  emitMemoryCorrected: (...args: unknown[]) => mockEmitMemoryCorrected(...args),
}));

import { correctCreativeMemory } from '../actions';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

const sampleExistingMemory: CreativeMemory = {
  id: 'mem-123',
  workspaceId: 'ws-1',
  category: 'audience',
  key: 'preferred_tone',
  value: 'casual',
  confidence: 'high',
  source: 'agent_inference',
  evidence: JSON.stringify([{ type: 'initial', reason: 'onboarding' }]),
  scope: 'global',
  version: 1,
  isDeleted: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe('correctCreativeMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnThis();
    mockBind.mockReturnThis();
  });

  it('returns NOT_AUTHENTICATED when no user session exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Brand voice shift',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns VALIDATION_FAILED when memoryId is empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await correctCreativeMemory({
      memoryId: '',
      correctedContent: 'formal',
      correctionReason: 'Brand voice shift',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('returns VALIDATION_FAILED when correctionReason is empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('returns MEMORY_NOT_FOUND when memory workspace lookup returns null', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce(null);

    const result = await correctCreativeMemory({
      memoryId: 'nonexistent-mem',
      correctedContent: 'formal',
      correctionReason: 'Update',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MEMORY_NOT_FOUND');
      expect(result.error.message).toBe('Memory not found');
    }
  });

  it('returns FORBIDDEN when user is not a member of the workspace', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({ workspace_id: 'ws-foreign' });
    vi.mocked(verifyWorkspaceAccess).mockResolvedValueOnce(false);

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Update',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe('You do not have access to this workspace');
    }
    expect(verifyWorkspaceAccess).toHaveBeenCalledWith('ws-foreign', 'user-001', fakeD1);
  });

  it('returns MEMORY_NOT_FOUND when existing memory cannot be loaded from store', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({ workspace_id: 'ws-1' });
    vi.mocked(verifyWorkspaceAccess).mockResolvedValueOnce(true);
    mockStoreGet.mockResolvedValueOnce(failure(new Error('not found')));

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Update',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MEMORY_NOT_FOUND');
    }
  });

  it('returns DB_ERROR when creativeMemoryStore.put fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({ workspace_id: 'ws-1' });
    vi.mocked(verifyWorkspaceAccess).mockResolvedValueOnce(true);
    mockStoreGet.mockResolvedValueOnce(success(sampleExistingMemory));
    mockStorePut.mockResolvedValueOnce(failure(new Error('D1 write error')));

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Update',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR');
      expect(result.error.message).toBe('Failed to update memory');
    }
  });

  it('returns DB_ERROR when retrieving updated memory fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({ workspace_id: 'ws-1' });
    vi.mocked(verifyWorkspaceAccess).mockResolvedValueOnce(true);
    mockStoreGet
      .mockResolvedValueOnce(success(sampleExistingMemory))
      .mockResolvedValueOnce(failure(new Error('retrieve failed')));
    mockStorePut.mockResolvedValueOnce(success('mem-123'));

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Update',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR');
      expect(result.error.message).toBe('Failed to retrieve updated memory');
    }
  });

  it('happy path: updates memory, emits event, and returns success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({ workspace_id: 'ws-1' });
    vi.mocked(verifyWorkspaceAccess).mockResolvedValueOnce(true);

    const updatedMemory: CreativeMemory = {
      ...sampleExistingMemory,
      value: 'formal',
      version: 2,
      source: 'human_edit',
      updatedAt: 1_700_000_010_000,
    };

    mockStoreGet
      .mockResolvedValueOnce(success(sampleExistingMemory))
      .mockResolvedValueOnce(success(updatedMemory));
    mockStorePut.mockResolvedValueOnce(success('mem-123'));
    mockEmitMemoryCorrected.mockResolvedValueOnce(true);

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Shift to professional audience',
      missionId: 'm-01',
      agentId: 'ag-01',
      runId: 'r-01',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventEmitted).toBe(true);
      expect(result.value.memory.value).toBe('formal');
      expect(result.value.memory.version).toBe(2);
    }

    expect(mockStorePut).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        value: 'formal',
        source: 'human_edit',
      }),
    );
    expect(mockEmitMemoryCorrected).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        missionId: 'm-01',
        agentId: 'ag-01',
        runId: 'r-01',
        correctionType: 'content_correction',
        previousConfidence: 'high',
      }),
    );
  });

  it('succeeds even if emitMemoryCorrected throws (non-fatal telemetry)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    mockFirst.mockResolvedValueOnce({ workspace_id: 'ws-1' });
    vi.mocked(verifyWorkspaceAccess).mockResolvedValueOnce(true);

    const updatedMemory: CreativeMemory = {
      ...sampleExistingMemory,
      value: 'formal',
      version: 2,
    };

    mockStoreGet
      .mockResolvedValueOnce(success(sampleExistingMemory))
      .mockResolvedValueOnce(success(updatedMemory));
    mockStorePut.mockResolvedValueOnce(success('mem-123'));
    mockEmitMemoryCorrected.mockRejectedValueOnce(new Error('Event bus down'));

    const result = await correctCreativeMemory({
      memoryId: 'mem-123',
      correctedContent: 'formal',
      correctionReason: 'Shift tone',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventEmitted).toBe(false);
      expect(result.value.memory.value).toBe('formal');
    }
  });
});
