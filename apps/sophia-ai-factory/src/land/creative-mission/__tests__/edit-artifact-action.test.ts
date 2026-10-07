/**
 * Unit and integration tests for editCreativeArtifact Server Action.
 * Covers validation, auth guard, IDOR access check, persistence, provenance,
 * creative memory learning, and reality loop telemetry emitter wiring.
 *
 * @module land/creative-mission/__tests__/edit-artifact-action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { editCreativeArtifact } from '../edit-artifact-action';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1: vi.fn(),
  verifyWorkspaceAccess: vi.fn(),
  recordProvenance: vi.fn(),
  recordLearning: vi.fn(),
  emitCreativeEdited: vi.fn(),
  prepare: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: mocks.verifyWorkspaceAccess,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
}));

vi.mock('@/tree/provenance', () => ({
  recordProvenance: mocks.recordProvenance,
  newProvenanceId: () => 'prov_test_123',
}));

vi.mock('@/tree/creative-memory', () => ({
  recordLearning: mocks.recordLearning,
}));

vi.mock('@/tree/performance/loop-emitters-creative', () => ({
  emitCreativeEdited: mocks.emitCreativeEdited,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

describe('editCreativeArtifact Server Action', () => {
  const fakeD1 = {
    prepare: mocks.prepare,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'usr_owner_1' });
    mocks.getD1.mockResolvedValue(fakeD1);
    mocks.verifyWorkspaceAccess.mockResolvedValue(true);
    mocks.recordProvenance.mockResolvedValue({});
    mocks.recordLearning.mockResolvedValue({});
    mocks.emitCreativeEdited.mockResolvedValue(true);

    mocks.prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          metadata: JSON.stringify({ hook: 'old hook' }),
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    });
  });

  it('rejects invalid inputs with VALIDATION_ERROR', async () => {
    const res = await editCreativeArtifact({
      workspaceId: '',
      missionId: 'msn_1',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns UNAUTHORIZED when session is missing', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await editCreativeArtifact({
      workspaceId: 'ws_1',
      missionId: 'msn_1',
      assetId: 'ast_1',
      changes: { hook: 'new hook' },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns DB_ERROR when D1 is unavailable', async () => {
    mocks.getD1.mockResolvedValue(null);
    const res = await editCreativeArtifact({
      workspaceId: 'ws_1',
      missionId: 'msn_1',
      assetId: 'ast_1',
      changes: { hook: 'new hook' },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DB_ERROR');
    }
  });

  it('returns FORBIDDEN when user lacks workspace access', async () => {
    mocks.verifyWorkspaceAccess.mockResolvedValue(false);
    const res = await editCreativeArtifact({
      workspaceId: 'ws_denied',
      missionId: 'msn_1',
      assetId: 'ast_1',
      changes: { hook: 'new hook' },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('FORBIDDEN');
    }
  });

  it('updates artifact, records provenance, learns, and emits telemetry', async () => {
    const input = {
      workspaceId: 'ws_valid',
      missionId: 'msn_alpha',
      assetId: 'ast_script_99',
      graphRunId: 'run_732b',
      nodeId: 'script_generator',
      agentSlug: 'creative-director',
      editCount: 2,
      changes: {
        headline: '5 Bí quyết kinh doanh Dropshipping triệu đô',
        scriptContent: 'Nội dung cập nhật...',
      },
      reason: 'Tối ưu câu mở đầu giật tít hơn',
    };

    const res = await editCreativeArtifact(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.assetId).toBe('ast_script_99');
      expect(res.value.version).toBe(2);
      expect(res.value.updated).toBe(true);
    }

    // Verify provenance call
    expect(mocks.recordProvenance).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'ast_script_99',
        action: 'edited',
        actorType: 'human',
        actorId: 'usr_owner_1',
      })
    );

    // Verify creative memory learning call
    expect(mocks.recordLearning).toHaveBeenCalledWith(
      'ws_valid',
      'creative',
      'edit:ast_script_99',
      input.changes,
      'Tối ưu câu mở đầu giật tít hơn',
      'project',
      'msn_alpha'
    );

    // Verify Reality Loop emitter call with disambiguated editCount
    expect(mocks.emitCreativeEdited).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_valid',
        missionId: 'msn_alpha',
        graphRunId: 'run_732b',
        nodeId: 'script_generator',
        assetId: 'ast_script_99',
        agentSlug: 'creative-director',
        editCount: 2,
      })
    );

    // Verify cache revalidation
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/missions');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('missions', 'max');
    expect(mocks.revalidateTag).toHaveBeenCalledWith('mission_msn_alpha', 'max');
  });

  it('succeeds even if telemetry or learning side-channels throw', async () => {
    mocks.recordLearning.mockRejectedValue(new Error('memory down'));
    mocks.emitCreativeEdited.mockRejectedValue(new Error('telemetry failed'));

    const res = await editCreativeArtifact({
      workspaceId: 'ws_valid',
      missionId: 'msn_1',
      assetId: 'ast_1',
      changes: { headline: 'new title' },
    });

    expect(res.ok).toBe(true);
  });
});
