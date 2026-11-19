import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbFrom: vi.fn(),
  resolveOrgId: vi.fn(),
  deductCredits: vi.fn(),
  getCommand: vi.fn(),
  loadHandler: vi.fn(),
  failMission: vi.fn(),
  executeMissionHandlerWithTimeout: vi.fn(),
  finalizeMissionExecution: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mocks.dbFrom }),
}));

vi.mock('@/seed/auth/org-resolver', () => ({
  resolveOrgId: mocks.resolveOrgId,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  deductCredits: mocks.deductCredits,
}));

vi.mock('@/tree/missions/command-registry', () => ({
  getCommand: mocks.getCommand,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./queue-router', () => ({
  loadHandler: mocks.loadHandler,
  failMission: mocks.failMission,
}));

vi.mock('./mission-handler-runner', () => ({
  executeMissionHandlerWithTimeout: mocks.executeMissionHandlerWithTimeout,
}));

vi.mock('./mission-state-helpers', () => ({
  parseMissionParams: (_id: string, raw: string | null) => (raw ? JSON.parse(raw) : {}),
  finalizeMissionExecution: mocks.finalizeMissionExecution,
}));

import { dispatchMission } from './mission-dispatch-engine';

function setupMissionDb(paramsJson: string | null) {
  const selectChain = {
    select: vi.fn(() => selectChain),
    eq: vi.fn(() => selectChain),
    single: vi.fn(async () => ({
      data: {
        id: 'mission-1',
        user_id: 'user-1',
        command: 'ai:write',
        params: paramsJson,
        status: 'pending',
        webhook_url: null,
      },
      error: null,
    })),
  };
  const updateChain = {
    update: vi.fn(() => updateChain),
    eq: vi.fn(() => updateChain),
    then: vi.fn((resolve: (v: unknown) => void) => resolve({ data: null, error: null })),
  };
  mocks.dbFrom.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);
}

describe('G4: mission dispatcher trusted server-side orgId resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCommand.mockReturnValue({ credits: 5 });
    mocks.loadHandler.mockResolvedValue(vi.fn());
    mocks.deductCredits.mockResolvedValue(true);
    mocks.executeMissionHandlerWithTimeout.mockResolvedValue({ ok: true, data: {} });
  });

  it('resolves orgId server-side from user membership and passes it to the handler', async () => {
    setupMissionDb(JSON.stringify({ task: 'video_script', topic: 'RaaS' }));
    mocks.resolveOrgId.mockResolvedValue('org-verified-1');

    await dispatchMission('mission-1');

    expect(mocks.resolveOrgId).toHaveBeenCalledWith('user-1');
    expect(mocks.executeMissionHandlerWithTimeout).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-verified-1' }),
    );
    expect(mocks.failMission).not.toHaveBeenCalled();
  });

  it('rejects spoofed caller params.orgId before deducting credits or invoking handler', async () => {
    setupMissionDb(JSON.stringify({ task: 'video_script', orgId: 'org-victim-999' }));
    mocks.resolveOrgId.mockResolvedValue('org-verified-1');

    await dispatchMission('mission-1');

    expect(mocks.failMission).toHaveBeenCalledWith(expect.anything(), 'mission-1', 'unauthorized_org');
    expect(mocks.deductCredits).not.toHaveBeenCalled();
    expect(mocks.executeMissionHandlerWithTimeout).not.toHaveBeenCalled();
  });

  it('rejects dual-key spoofed org_id even when orgId matches resolved org', async () => {
    setupMissionDb(JSON.stringify({ task: 'video_script', orgId: 'org-verified-1', org_id: 'org-victim-999' }));
    mocks.resolveOrgId.mockResolvedValue('org-verified-1');

    await dispatchMission('mission-1');

    expect(mocks.failMission).toHaveBeenCalledWith(expect.anything(), 'mission-1', 'unauthorized_org');
    expect(mocks.deductCredits).not.toHaveBeenCalled();
    expect(mocks.executeMissionHandlerWithTimeout).not.toHaveBeenCalled();
  });

  it('fails closed when orgId resolution throws', async () => {
    setupMissionDb(JSON.stringify({ task: 'video_script' }));
    mocks.resolveOrgId.mockRejectedValue(new Error('D1 unavailable'));

    await dispatchMission('mission-1');

    expect(mocks.failMission).toHaveBeenCalledWith(expect.anything(), 'mission-1', 'org_resolution_failed');
    expect(mocks.deductCredits).not.toHaveBeenCalled();
    expect(mocks.executeMissionHandlerWithTimeout).not.toHaveBeenCalled();
  });
});
