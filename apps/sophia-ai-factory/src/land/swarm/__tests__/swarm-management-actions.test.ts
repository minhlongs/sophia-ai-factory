import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSwarmClusterTopologyAction,
  registerSwarmNodeAction,
  heartbeatSwarmNodeAction,
  triggerRetentionFlywheelSweepAction,
  getCustomerHealthMetricsAction,
  executeManualInterventionAction,
  getEdgeHealingIncidentsAction,
  isolateDegradedNodeAction,
  resolveHealingIncidentAction,
  qualifyLeadAction,
  runSelfHealingSweepAction,
} from '../swarm-management-actions';
import * as authSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import * as coordinator from '@/tree/swarm/swarm-coordinator';
import * as retention from '@/tree/swarm/retention-flywheel-engine';
import * as qualifier from '@/tree/swarm/sales-qualifier-bot';
import * as arbiter from '@/tree/swarm/self-healing-arbiter';
import type {
  SwarmClusterTopology,
  SwarmNode,
  CustomerHealthMetric,
} from '@/seed/types/autonomous-swarm';

vi.mock('@/seed/auth/better-auth-session');
vi.mock('@/seed/db/client');
vi.mock('@/tree/swarm/swarm-coordinator');
vi.mock('@/tree/swarm/retention-flywheel-engine');
vi.mock('@/tree/swarm/sales-qualifier-bot');
vi.mock('@/tree/swarm/self-healing-arbiter');

describe('swarm-management-actions', () => {
  const mockUser: dbClient.User = {
    id: 'usr_swarm_admin',
    email: 'admin@example.com',
    full_name: 'Swarm Admin',
    role: 'admin',
  };
  const mockDb = {} as dbClient.D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb);
  });

  it('rejects unauthorized caller when no session is present', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(null);

    const result = await getSwarmClusterTopologyAction();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TOPOLOGY_ERROR');
      expect(result.error.message).toContain('UNAUTHORIZED');
    }
  });

  it('fetches swarm cluster topology after pruning dead nodes', async () => {
    const mockTopology: SwarmClusterTopology = {
      totalNodes: 5,
      activeNodesCount: 5,
      degradedNodesCount: 0,
      isolatedNodesCount: 0,
      coordinatorNodeId: 'node_1',
      regionalDistribution: { apac: 2, us: 3, eu: 0, global: 0 },
      nodes: [],
    };
    vi.mocked(coordinator.getSwarmClusterTopology).mockResolvedValue(mockTopology);

    const result = await getSwarmClusterTopologyAction();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(mockTopology);
    }
    expect(coordinator.pruneDeadNodes).toHaveBeenCalledWith(mockDb);
  });

  it('validates and registers a new swarm node', async () => {
    vi.mocked(coordinator.registerSwarmNode).mockResolvedValue({ id: 'node_registered_99' } as unknown as SwarmNode);

    const result = await registerSwarmNodeAction({
      nodeName: 'daemon-sgp-1',
      region: 'apac',
      role: 'sales_qualifier',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nodeId).toBe('node_registered_99');
    }
  });

  it('fails registerSwarmNodeAction if required fields are missing', async () => {
    const result = await registerSwarmNodeAction({
      nodeName: '',
      region: '' as unknown as 'apac',
      role: 'sales_qualifier',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('records heartbeat telemetry metrics', async () => {
    vi.mocked(coordinator.recordNodeHeartbeat).mockResolvedValue({ success: true, acknowledgedAt: Date.now() });

    const result = await heartbeatSwarmNodeAction({
      nodeId: 'node_42',
      cpuLoadPct: 45,
      memoryLoadPct: 60,
      activeTasks: 3,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.acknowledged).toBe(true);
    }
  });

  it('executes triggerRetentionFlywheelSweepAction', async () => {
    vi.mocked(retention.runRetentionSweepBatch).mockResolvedValue({
      evaluatedCount: 15,
      interventionsTriggered: 2,
    });

    const result = await triggerRetentionFlywheelSweepAction(20);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evaluatedCount).toBe(15);
    }
  });

  it('gets customer health metrics or returns validation error on missing id', async () => {
    vi.mocked(retention.getCustomerHealthSummary).mockResolvedValue({
      customerId: 'cust_77',
      churnRiskScore: 0.12,
      riskLevel: 'LOW',
    } as unknown as CustomerHealthMetric);

    const result = await getCustomerHealthMetricsAction('cust_77');
    expect(result.ok).toBe(true);

    const badResult = await getCustomerHealthMetricsAction('');
    expect(badResult.ok).toBe(false);
  });

  it('runs self-healing sweep', async () => {
    vi.mocked(arbiter.runSelfHealingSweep).mockResolvedValue({
      evaluatedNodes: 8,
      incidentsCreated: 1,
      reroutesExecuted: 1,
    });

    const result = await runSelfHealingSweepAction();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evaluatedNodes).toBe(8);
    }
  });
});
