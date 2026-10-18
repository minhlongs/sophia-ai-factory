import { describe, expect, it, vi } from 'vitest';

const {
  toggleAutoApplyMock,
  createServerClientMock,
  prepareMock,
  bindMock,
  runMock,
} = vi.hoisted(() => ({
  toggleAutoApplyMock: vi.fn(),
  createServerClientMock: vi.fn(),
  prepareMock: vi.fn(),
  bindMock: vi.fn(),
  runMock: vi.fn(),
}));

vi.mock('@/forest/patterns', () => ({ listRules: vi.fn() }));
vi.mock('@/land/playbook/playbook-applier', () => ({
  applyPlaybook: vi.fn(),
  toggleAutoApply: toggleAutoApplyMock,
}));
vi.mock('@/seed/db/client', () => ({ createServerClient: createServerClientMock }));

const { executePlaybookRollback, handlePlaybookPostAction } = await import('./playbook-route-helpers');

describe('playbook route ownership', () => {
  it('passes the authenticated owner to auto-apply toggles and returns 404 for foreign installs', async () => {
    toggleAutoApplyMock.mockResolvedValue({
      success: false,
      code: 'NOT_FOUND',
      message: 'Installation not found',
    });

    const response = await handlePlaybookPostAction('user-a', {
      action: 'toggle',
      installationId: 'install-b',
      enabled: false,
    });

    expect(toggleAutoApplyMock).toHaveBeenCalledWith('install-b', false, 'user-a');
    expect(response.status).toBe(404);
  });

  it('scopes rollback updates to the authenticated owner and avoids rule mutation when absent', async () => {
    runMock.mockResolvedValue({ meta: { changes: 0 } });
    bindMock.mockReturnValue({ run: runMock });
    prepareMock.mockReturnValue({ bind: bindMock });
    createServerClientMock.mockReturnValue({ prepare: prepareMock });

    const response = await executePlaybookRollback('install-b', 'user-a', 'rule-b');

    expect(response.status).toBe(404);
    expect(prepareMock).toHaveBeenCalledTimes(1);
    expect(prepareMock.mock.calls[0]?.[0]).toContain('WHERE id = ?1 AND user_id = ?2');
    expect(bindMock).toHaveBeenCalledWith('install-b', 'user-a');
  });
});
