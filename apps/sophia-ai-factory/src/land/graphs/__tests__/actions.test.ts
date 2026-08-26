/**
 * Land graphs server action tests.
 *
 * Covers the land→tree delegation contract for graph read APIs:
 *   - getIpLineageAction surfaces tree IPGraphError codes unchanged
 *   - getContentLineageAction surfaces tree ContentGraphError codes unchanged
 *   - listProjectsAction delegates to tree listProjects
 *   - All actions return 401 when unauthenticated
 *   - All actions return 403 when workspace access denied
 *
 * Harness: vi.mock module style (see creative-mission actions.test.ts).
 *
 * @module land/graphs/__tests__/actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createServerClient: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  // tree/ip-graph
  getIP: vi.fn(),
  getIPChildren: vi.fn(),
  getIPDerivatives: vi.fn(),
  listIP: vi.fn(),
  // tree/content-graph
  getContentLineage: vi.fn(),
  getContentPerformance: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

vi.mock('@/tree/ip-graph', () => ({
  getIP: mocks.getIP,
  getIPChildren: mocks.getIPChildren,
  getIPDerivatives: mocks.getIPDerivatives,
  listIP: mocks.listIP,
}));

vi.mock('@/tree/content-graph', () => ({
  getContentLineage: mocks.getContentLineage,
  getContentPerformance: mocks.getContentPerformance,
  listProjects: mocks.listProjects,
}));

/** Build an IPGraphError-shaped error (name-based detection in actionFailure). */
function ipGraphError(code: string, message: string): Error {
  const err = new Error(message);
  err.name = 'IPGraphError';
  (err as Error & { code: string }).code = code;
  return err;
}

/** Build a ContentGraphError-shaped error. */
function contentGraphError(code: string, message: string): Error {
  const err = new Error(message);
  err.name = 'ContentGraphError';
  (err as Error & { code: string }).code = code;
  return err;
}

/** Minimal D1 stub: prepare().bind().first() driven by a queue. */
function makeD1(results: Array<unknown>) {
  let i = 0;
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => results[i++],
        all: async () => ({ results: (results[i++] as unknown[]) ?? [], meta: {} }),
      }),
    }),
  };
}

const USER = { id: 'user_1' };
const WS_ID = 'ws_1';

describe('land/graphs actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getIpLineageAction ────────────────────────────────────────────────────

  describe('getIpLineageAction', () => {
    const validInput = { workspaceId: WS_ID, ipId: 'ip_1' };
    const mockIP = {
      id: 'ip_1',
      workspaceId: WS_ID,
      type: 'universe' as const,
      name: 'Starfall',
      description: 'A space opera universe',
      metadata: {},
      status: 'approved' as const,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const mockChildren = [
      { ...mockIP, id: 'ip_2', name: 'Series 1', parentId: 'ip_1' },
      { ...mockIP, id: 'ip_3', name: 'Character 1', parentId: 'ip_2' },
    ];
    const mockDerivatives = [
      { ...mockIP, id: 'ip_4', name: 'Theme 1', parentId: 'ip_3' },
    ];

    it('returns 401 when unauthenticated', async () => {
      mocks.getCurrentUser.mockResolvedValue(null);

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns 403 when workspace access denied', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([null]),
      );

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 404 when IP entity not found', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getIP.mockResolvedValue(null);

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns 403 when IP belongs to different workspace', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getIP.mockResolvedValue({ ...mockIP, workspaceId: 'other_ws' });

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('surfaces tree IPGraphError codes unchanged', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getIP.mockRejectedValue(ipGraphError('D1_UNAVAILABLE', 'D1 not available'));

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('D1_UNAVAILABLE');
      }
    });

    it('returns success with ip, children, and derivatives', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getIP.mockResolvedValue(mockIP);
      mocks.getIPChildren.mockResolvedValue(mockChildren);
      mocks.getIPDerivatives.mockResolvedValue(mockDerivatives);

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.ip) {
        expect(result.value.ip.id).toBe('ip_1');
        expect(result.value.children).toHaveLength(2);
        expect(result.value.derivatives).toHaveLength(1);
      }
      expect(mocks.getIP).toHaveBeenCalledWith('ip_1');
      expect(mocks.getIPChildren).toHaveBeenCalledWith('ip_1');
      expect(mocks.getIPDerivatives).toHaveBeenCalledWith('ip_1');
    });

    it('maps non-MissionError exceptions to INTERNAL', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getIP.mockRejectedValue(new Error('DB connection lost'));

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INTERNAL');
      }
    });

    it('validates input schema', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);

      const { getIpLineageAction } = await import('../actions');
      const result = await getIpLineageAction({ workspaceId: '', ipId: 'ip_1' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ── getContentLineageAction ───────────────────────────────────────────────

  describe('getContentLineageAction', () => {
    const validInput = { workspaceId: WS_ID, projectId: 'prj_1' };
    const mockLineage = {
      project: {
        id: 'prj_1',
        workspaceId: WS_ID,
        missionId: 'mis_1',
        creatorId: 'cr_1',
        brandId: 'br_1',
        title: 'June Launch',
        description: 'Campaign project',
        format: 'video_long' as const,
        status: 'in_production' as const,
        budgetCents: 25000,
        actualCostCents: 3000,
        metadata: { quarter: 'Q2' },
        createdAt: 1000,
        updatedAt: 1000,
      },
      assets: [
        {
          id: 'ast_1',
          workspaceId: WS_ID,
          projectId: 'prj_1',
          type: 'video' as const,
          storageKey: 'r2/video.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 1024,
          durationSeconds: 60,
          status: 'approved' as const,
          metadata: {},
          createdAt: 2000,
          updatedAt: 2000,
        },
      ],
      derivatives: [
        {
          id: 'der_1',
          workspaceId: WS_ID,
          sourceAssetId: 'ast_1',
          parentAssetId: 'ast_1',
          type: 'clip' as const,
          storageKey: 'r2/clip.mp4',
          metadata: {},
          createdAt: 3000,
        },
      ],
      performance: [
        {
          id: 'pe_1',
          channel: 'youtube',
          eventType: 'view',
          count: 1000,
          recordedAt: 4000,
        },
      ],
    };

    it('returns 401 when unauthenticated', async () => {
      mocks.getCurrentUser.mockResolvedValue(null);

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns 403 when workspace access denied', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([null]),
      );

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns 404 when project not found', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getContentLineage.mockResolvedValue(null);

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns 403 when project belongs to different workspace', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getContentLineage.mockResolvedValue({
        ...mockLineage,
        project: { ...mockLineage.project, workspaceId: 'other_ws' },
      });

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('surfaces tree ContentGraphError codes unchanged', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getContentLineage.mockRejectedValue(contentGraphError('D1_UNAVAILABLE', 'D1 not available'));

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('D1_UNAVAILABLE');
      }
    });

    it('returns success with full lineage', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getContentLineage.mockResolvedValue(mockLineage);

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(true);
      if (result.ok && result.value !== null) {
        expect(result.value.project.id).toBe('prj_1');
        expect(result.value.assets).toHaveLength(1);
        expect(result.value.derivatives).toHaveLength(1);
        expect(result.value.performance).toHaveLength(1);
      }
      expect(mocks.getContentLineage).toHaveBeenCalledWith('prj_1');
    });

    it('maps non-MissionError exceptions to INTERNAL', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.getContentLineage.mockRejectedValue(new Error('DB connection lost'));

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INTERNAL');
      }
    });

    it('validates input schema', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);

      const { getContentLineageAction } = await import('../actions');
      const result = await getContentLineageAction({ workspaceId: '', projectId: 'prj_1' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ── listProjectsAction ────────────────────────────────────────────────────

  describe('listProjectsAction', () => {
    const validInput = { workspaceId: WS_ID };
    const mockProjects = [
      {
        id: 'prj_1',
        workspaceId: WS_ID,
        missionId: 'mis_1',
        creatorId: 'cr_1',
        brandId: 'br_1',
        title: 'Project 1',
        description: '',
        format: 'video_long' as const,
        status: 'in_production' as const,
        budgetCents: 10000,
        actualCostCents: 2000,
        metadata: {},
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'prj_2',
        workspaceId: WS_ID,
        missionId: 'mis_2',
        creatorId: 'cr_1',
        brandId: 'br_1',
        title: 'Project 2',
        description: '',
        format: 'video_short' as const,
        status: 'draft' as const,
        budgetCents: 5000,
        actualCostCents: 1000,
        metadata: {},
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    it('returns 401 when unauthenticated', async () => {
      mocks.getCurrentUser.mockResolvedValue(null);

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns 403 when workspace access denied', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([null]),
      );

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('surfaces tree ContentGraphError codes unchanged', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.listProjects.mockRejectedValue(contentGraphError('D1_UNAVAILABLE', 'D1 not available'));

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('D1_UNAVAILABLE');
      }
    });

    it('returns success with projects and count', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.listProjects.mockResolvedValue(mockProjects);

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction(validInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.projects).toHaveLength(2);
        expect(result.value.count).toBe(2);
      }
      expect(mocks.listProjects).toHaveBeenCalledWith(WS_ID, undefined);
    });

    it('passes missionId filter when provided', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.listProjects.mockResolvedValue([mockProjects[0]]);

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction({ workspaceId: WS_ID, missionId: 'mis_1' });

      expect(result.ok).toBe(true);
      expect(mocks.listProjects).toHaveBeenCalledWith(WS_ID, 'mis_1');
    });

    it('maps non-MissionError exceptions to INTERNAL', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.createServerClient.mockReturnValue(
        makeD1([{}]),
      );
      mocks.listProjects.mockRejectedValue(new Error('DB connection lost'));

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INTERNAL');
      }
    });

    it('validates input schema', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);

      const { listProjectsAction } = await import('../actions');
      const result = await listProjectsAction({ workspaceId: '' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});