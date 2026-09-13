/**
 * Multi-Tenant Route Isolation & Data Boundary Integration Test Suite
 * for Creative Domain & Creative Intelligence Routes
 *
 * Verifies that consolidated routes:
 * - /api/creative-memory
 * - /api/creative-memory/[id]
 * - /api/creative-memory/velocity
 * - /api/creative-memory/strategy-feedback
 * - /api/creative-memory/experiments
 * - /api/content-graph
 * - /api/content-graph/[id]
 * - /api/content-graph/cross-platform
 * - /api/creative-intelligence/trend-matrix
 * - /api/creative-intelligence/hook-dna
 *
 * Strictly enforce multi-tenant isolation via canonical seed primitives:
 * 1. Cross-tenant access rejection (User of Tenant A accessing Tenant B -> 403 Forbidden)
 * 2. Role hierarchy rejection (MEMBER/VIEWER attempting OPERATOR mutations -> 403 Forbidden)
 * 3. Data boundary enforcement (Zero data leakage between distinct workspace IDs)
 * 4. Unauthenticated access rejection (No session -> 401 Unauthorized)
 *
 * Layer: seed/auth/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks to avoid TDZ issues with vi.mock
const { MockD1Client, mockD1, getMockUser, setMockUser } = vi.hoisted(() => {
  const dbRoles: Record<string, { role: string }> = {
    'tenant_a:user_alice': { role: 'OWNER' },
    'tenant_a:user_bob': { role: 'MEMBER' },
    'tenant_b:user_carol': { role: 'ADMIN' },
    'tenant_b:user_dave': { role: 'VIEWER' },
  };

  let currentUser: { id: string; email?: string } | null = null;

  const mockPrepare = vi.fn().mockImplementation((sql: string) => {
    return {
      bind: vi.fn().mockImplementation((...args: unknown[]) => {
        return {
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('org_members')) {
              const orgId = String(args[0]);
              const userId = String(args[1]);
              const key = `${orgId}:${userId}`;
              return dbRoles[key] ?? null;
            }
            if (sql.includes('FROM creative_memory WHERE id = ?')) {
              const memId = String(args[0]);
              if (memId === 'mem_a') return { workspace_id: 'tenant_a' };
              if (memId === 'mem_b') return { workspace_id: 'tenant_b' };
              return null;
            }
            if (sql.includes('creative_memory') && sql.includes('SELECT id, workspace_id')) {
              const memId = String(args[0]);
              if (memId === 'mem_a') {
                return {
                  id: 'mem_a',
                  workspace_id: 'tenant_a',
                  category: 'creative',
                  key: 'brand_voice',
                  value: '{"tone":"sharp"}',
                  confidence: 'high',
                  source: 'human_edit',
                  evidence: '[]',
                  scope: 'global',
                  scope_id: null,
                  version: 1,
                  is_deleted: 0,
                  created_at: 1000,
                  updated_at: 1000,
                  expires_at: null,
                };
              }
              return null;
            }
            if (sql.includes('creative_memory') && sql.includes('key = ?')) {
              return { id: 'rec_1', value: '{"id":"strat_1","applied":false,"recommendation":"test"}' };
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('learning_velocity')) {
              const orgId = String(args[0]);
              if (orgId === 'tenant_a') {
                return {
                  results: [
                    {
                      id: 'vel_1',
                      workspace_id: 'tenant_a',
                      entity_type: 'video',
                      channel: 'youtube',
                      velocity_score: 85,
                      event_count: 10,
                      window_start_ms: 1000,
                      window_end_ms: 2000,
                      avg_metrics: '{}',
                      created_at: 2000,
                    },
                  ],
                };
              }
              return { results: [] };
            }
            if (sql.includes('trend_detections')) {
              const orgId = String(args[0]);
              if (orgId === 'tenant_a') {
                return {
                  results: [
                    {
                      id: 'trd_1',
                      workspace_id: 'tenant_a',
                      topic: 'AI video',
                      channel: 'youtube',
                      momentum: 92,
                      forecast: null,
                      evidence_ids: null,
                      detected_at: 2000,
                    },
                  ],
                };
              }
              return { results: [] };
            }
            if (sql.includes('playbook_patterns')) {
              const orgId = String(args[0]);
              if (orgId === 'tenant_a') {
                return {
                  results: [
                    {
                      id: 'pat_1',
                      workspace_id: 'tenant_a',
                      feature_key: 'hook_type',
                      feature_value: 'question_hook',
                      metric: 'ctr',
                      avg_metric: 0.12,
                      sample_size: 50,
                      confidence: 0.85,
                      confidence_level: 'high',
                      source: 'experiment',
                      detected_at: 2000,
                    },
                  ],
                };
              }
              return { results: [] };
            }
            if (sql.includes('distribution_assets')) {
              const orgId = String(args[0]);
              if (orgId === 'tenant_a') {
                return {
                  results: [
                    {
                      id: 'dast_1',
                      workspace_id: 'tenant_a',
                      plan_id: 'dp_1',
                      asset_id: 'ast_1',
                      channel: 'youtube',
                      platform_post_id: 'yt_123',
                      status: 'scheduled',
                      scheduled_at: 2000,
                      posted_at: null,
                      analytics: '{}',
                      error: null,
                      created_at: 1000,
                    },
                  ],
                };
              }
              return { results: [] };
            }
            return { results: [] };
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      }),
    };
  });

  class MockD1Client {
    prepare(sql: string) {
      return mockPrepare(sql);
    }
  }

  const mockD1 = new MockD1Client();

  return {
    MockD1Client,
    mockD1,
    getMockUser: () => currentUser,
    setMockUser: (u: { id: string; email?: string } | null) => {
      currentUser = u;
    },
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockImplementation(async () => getMockUser()),
}));

vi.mock('@/seed/db/client', () => ({
  D1Client: MockD1Client,
  createServerClient: vi.fn().mockReturnValue(mockD1),
  getD1: vi.fn().mockReturnValue(mockD1),
}));

// Mock tree domain repositories
vi.mock('@/tree/creative-memory', () => ({
  upsertMemory: vi.fn().mockResolvedValue({ id: 'mem_new', key: 'test_key' }),
  listMemoryKeys: vi.fn().mockResolvedValue(['test_key']),
  deleteMemory: vi.fn().mockResolvedValue(true),
  recordLearning: vi.fn().mockResolvedValue({ id: 'learn_1' }),
  newMemoryId: vi.fn().mockReturnValue('mem_new'),
}));

vi.mock('@/tree/content-graph', () => ({
  createProject: vi.fn().mockImplementation(async (data: { id: string; title: string }) => ({ ...data })),
  listProjects: vi.fn().mockImplementation(async (workspaceId: string) => {
    if (workspaceId === 'tenant_a') return [{ id: 'prj_a', workspaceId: 'tenant_a', title: 'Project A' }];
    return [];
  }),
  getProject: vi.fn().mockImplementation(async (id: string) => {
    if (id === 'prj_a') return { id: 'prj_a', workspaceId: 'tenant_a', title: 'Project A' };
    if (id === 'prj_b') return { id: 'prj_b', workspaceId: 'tenant_b', title: 'Project B' };
    return null;
  }),
  updateProjectStatus: vi.fn().mockImplementation(async (id: string, status: string) => ({
    id,
    workspaceId: 'tenant_a',
    status,
  })),
  newProjectId: vi.fn().mockReturnValue('prj_new'),
}));

vi.mock('@/tree/performance/experiment', () => ({
  createExperiment: vi.fn().mockResolvedValue(undefined),
  listExperiments: vi.fn().mockImplementation(async (workspaceId: string) => {
    if (workspaceId === 'tenant_a') return [{ id: 'exp_a', workspaceId: 'tenant_a' }];
    return [];
  }),
  newExperimentId: vi.fn().mockReturnValue('exp_new'),
}));

vi.mock('@/tree/trend-intelligence', () => ({
  detectTrends: vi.fn().mockResolvedValue({ ok: true, value: [{ id: 'trd_detected', topic: 'growth' }] }),
}));

// Import route handlers
import { POST as postMemory, GET as getMemory } from '@/app/api/creative-memory/route';
import { GET as getMemoryById, DELETE as deleteMemoryById } from '@/app/api/creative-memory/[id]/route';
import { GET as getVelocity, POST as postVelocity } from '@/app/api/creative-memory/velocity/route';
import { GET as getStrategyFeedback, POST as postStrategyFeedback } from '@/app/api/creative-memory/strategy-feedback/route';
import { GET as getExperiments, POST as postExperiments } from '@/app/api/creative-memory/experiments/route';
import { POST as postContentGraph, GET as getContentGraph } from '@/app/api/content-graph/route';
import { GET as getContentGraphById, PATCH as patchContentGraphById } from '@/app/api/content-graph/[id]/route';
import { GET as getCrossPlatform, POST as postCrossPlatform } from '@/app/api/content-graph/cross-platform/route';
import { GET as getTrendMatrix, POST as postTrendMatrix } from '@/app/api/creative-intelligence/trend-matrix/route';
import { GET as getHookDna, POST as postHookDna } from '@/app/api/creative-intelligence/hook-dna/route';

describe('Creative Routes Multi-Tenant Isolation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(null);
  });

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated requests reject with 401
  // ---------------------------------------------------------------------------
  describe('Unauthenticated callers reject with 401', () => {
    it('GET /api/creative-memory rejects unauthenticated caller', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory?workspaceId=tenant_a');
      const res = await getMemory(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/creative-memory/velocity rejects unauthenticated caller', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/velocity', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'tenant_a', entityType: 'video', channel: 'youtube', velocityScore: 80 }),
      });
      const res = await postVelocity(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/content-graph rejects unauthenticated caller', async () => {
      const req = new NextRequest('http://localhost/api/content-graph?workspaceId=tenant_a');
      const res = await getContentGraph(req);
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Cross-Tenant Access Rejection (Alice in Tenant A -> Tenant B resources)
  // ---------------------------------------------------------------------------
  describe('Cross-Tenant Access Rejection (User of Tenant A accessing Tenant B -> 403 Forbidden)', () => {
    beforeEach(() => {
      setMockUser({ id: 'user_alice', email: 'alice@tenant-a.com' });
    });

    it('POST /api/creative-memory rejects Alice writing to Tenant B with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          category: 'creative',
          key: 'forbidden_key',
          value: { hook: 'test' },
        }),
      });
      const res = await postMemory(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-memory rejects Alice reading Tenant B keys with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory?workspaceId=tenant_b');
      const res = await getMemory(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-memory/[id] rejects Alice reading Tenant B memory mem_b with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/mem_b');
      const res = await getMemoryById(req, { params: Promise.resolve({ id: 'mem_b' }) });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/creative-memory/[id] rejects Alice deleting Tenant B memory mem_b with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/mem_b', { method: 'DELETE' });
      const res = await deleteMemoryById(req, { params: Promise.resolve({ id: 'mem_b' }) });
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-memory/velocity rejects Alice reading Tenant B velocity with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/velocity?workspaceId=tenant_b');
      const res = await getVelocity(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/creative-memory/velocity rejects Alice writing Tenant B velocity with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/velocity', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          entityType: 'video',
          channel: 'youtube',
          velocityScore: 90,
        }),
      });
      const res = await postVelocity(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-memory/strategy-feedback rejects Alice reading Tenant B strategy with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/strategy-feedback?workspaceId=tenant_b');
      const res = await getStrategyFeedback(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-memory/experiments rejects Alice reading Tenant B experiments with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/experiments?workspaceId=tenant_b');
      const res = await getExperiments(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/content-graph rejects Alice creating project in Tenant B with 403', async () => {
      const req = new NextRequest('http://localhost/api/content-graph', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          title: 'Unauthorized Content Project',
        }),
      });
      const res = await postContentGraph(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/content-graph rejects Alice listing Tenant B projects with 403', async () => {
      const req = new NextRequest('http://localhost/api/content-graph?workspaceId=tenant_b');
      const res = await getContentGraph(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/content-graph/[id] rejects Alice reading Tenant B project prj_b with 403', async () => {
      const req = new NextRequest('http://localhost/api/content-graph/prj_b');
      const res = await getContentGraphById(req, { params: Promise.resolve({ id: 'prj_b' }) });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/content-graph/[id] rejects Alice updating Tenant B project prj_b with 403', async () => {
      const req = new NextRequest('http://localhost/api/content-graph/prj_b', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      });
      const res = await patchContentGraphById(req, { params: Promise.resolve({ id: 'prj_b' }) });
      expect(res.status).toBe(403);
    });

    it('GET /api/content-graph/cross-platform rejects Alice reading Tenant B distribution with 403', async () => {
      const req = new NextRequest('http://localhost/api/content-graph/cross-platform?workspaceId=tenant_b');
      const res = await getCrossPlatform(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-intelligence/trend-matrix rejects Alice reading Tenant B trends with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-intelligence/trend-matrix?workspaceId=tenant_b');
      const res = await getTrendMatrix(req);
      expect(res.status).toBe(403);
    });

    it('GET /api/creative-intelligence/hook-dna rejects Alice reading Tenant B hooks with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-intelligence/hook-dna?workspaceId=tenant_b');
      const res = await getHookDna(req);
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Role Hierarchy Rejection (Bob: MEMBER in Tenant A attempting OPERATOR mutations)
  // ---------------------------------------------------------------------------
  describe('Role Hierarchy Rejection (MEMBER / VIEWER attempting OPERATOR mutations -> 403 Forbidden)', () => {
    beforeEach(() => {
      // Bob is MEMBER in Tenant A
      setMockUser({ id: 'user_bob', email: 'bob@tenant-a.com' });
    });

    it('POST /api/creative-memory/velocity rejects MEMBER Bob with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/velocity', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          entityType: 'video',
          channel: 'youtube',
          velocityScore: 75,
        }),
      });
      const res = await postVelocity(req);
      expect(res.status).toBe(403);
      const data = await res.json() as { message?: string };
      expect(data.message).toBe('Insufficient workspace role');
    });

    it('POST /api/creative-memory/strategy-feedback rejects MEMBER Bob with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/strategy-feedback', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          recommendation: 'Increase hook speed',
        }),
      });
      const res = await postStrategyFeedback(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/creative-memory/experiments rejects MEMBER Bob with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/experiments', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          hypothesis: 'Shorter hooks convert better',
          metric: 'ctr',
        }),
      });
      const res = await postExperiments(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/content-graph/cross-platform rejects MEMBER Bob with 403', async () => {
      const req = new NextRequest('http://localhost/api/content-graph/cross-platform', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          planId: 'plan_1',
          assetId: 'ast_1',
          channel: 'tiktok',
        }),
      });
      const res = await postCrossPlatform(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/creative-intelligence/trend-matrix rejects MEMBER Bob with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-intelligence/trend-matrix', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          topic: 'AI Generated Avatars',
        }),
      });
      const res = await postTrendMatrix(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/creative-intelligence/hook-dna rejects MEMBER Bob with 403', async () => {
      const req = new NextRequest('http://localhost/api/creative-intelligence/hook-dna', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          hookType: 'question_hook',
          avgMetric: 0.15,
          sampleSize: 100,
          confidence: 0.9,
        }),
      });
      const res = await postHookDna(req);
      expect(res.status).toBe(403);
    });

    it('GET endpoints allow MEMBER Bob access to Tenant A resources', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory?workspaceId=tenant_a');
      const res = await getMemory(req);
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Data Boundary Enforcement & Authorized Operations
  // ---------------------------------------------------------------------------
  describe('Data Boundary Enforcement & Authorized Operations for Tenant Owner Alice', () => {
    beforeEach(() => {
      setMockUser({ id: 'user_alice', email: 'alice@tenant-a.com' });
    });

    it('GET /api/creative-memory/velocity returns Tenant A velocity data only', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/velocity?workspaceId=tenant_a');
      const res = await getVelocity(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { velocity: Array<{ workspaceId: string }> };
      expect(data.velocity.length).toBeGreaterThan(0);
      expect(data.velocity.every((v) => v.workspaceId === 'tenant_a')).toBe(true);
    });

    it('POST /api/creative-memory/velocity succeeds for OWNER Alice with 201', async () => {
      const req = new NextRequest('http://localhost/api/creative-memory/velocity', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_a',
          entityType: 'video',
          channel: 'youtube',
          velocityScore: 95,
        }),
      });
      const res = await postVelocity(req);
      expect(res.status).toBe(201);
      const data = await res.json() as { workspaceId: string };
      expect(data.workspaceId).toBe('tenant_a');
    });

    it('GET /api/content-graph returns only Tenant A projects', async () => {
      const req = new NextRequest('http://localhost/api/content-graph?workspaceId=tenant_a');
      const res = await getContentGraph(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { projects: Array<{ workspaceId: string }> };
      expect(data.projects.every((p) => p.workspaceId === 'tenant_a')).toBe(true);
    });

    it('GET /api/creative-intelligence/trend-matrix returns Tenant A trend detections only', async () => {
      const req = new NextRequest('http://localhost/api/creative-intelligence/trend-matrix?workspaceId=tenant_a');
      const res = await getTrendMatrix(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { trends: Array<{ workspaceId: string }> };
      expect(data.trends.length).toBeGreaterThan(0);
      expect(data.trends.every((t) => t.workspaceId === 'tenant_a')).toBe(true);
    });

    it('GET /api/creative-intelligence/hook-dna returns Tenant A hook patterns only', async () => {
      const req = new NextRequest('http://localhost/api/creative-intelligence/hook-dna?workspaceId=tenant_a');
      const res = await getHookDna(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { patterns: Array<{ workspaceId: string }> };
      expect(data.patterns.length).toBeGreaterThan(0);
      expect(data.patterns.every((p) => p.workspaceId === 'tenant_a')).toBe(true);
    });
  });
});
