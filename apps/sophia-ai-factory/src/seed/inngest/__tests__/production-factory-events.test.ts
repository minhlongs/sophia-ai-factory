/**
 * Production Factory contract guard — events + migration 0257.
 *
 * Proves the Phase 3 schema-and-contracts slice holds:
 * 1. The three production-graph event names are registered in the canonical
 *    merged Inngest schema with their typed payloads.
 * 2. Every production-graph payload round-trips through JSON unchanged.
 * 3. The creative-economy barrel re-exports the production-factory types.
 * 4. Migration 0257 exists and creates all three production tables plus the
 *    creative_missions.mission_type column (text parse — no DB required).
 *
 * Deterministic: no network, no database, no mocks.
 *
 * @module seed/inngest/__tests__/production-factory-events.test
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { Events } from '@/seed/inngest/event-types';
import type {
  GraphDefinition,
  MissionTypePolicy,
  ProductionGraphCompletedEvent,
  ProductionGraphFailedEvent,
  ProductionGraphRun,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
  ProductionGraphStartedEvent,
} from '@/seed/types/production-factory';
import type {
  MissionTypePolicy as BarrelMissionTypePolicy,
  ProductionGraphRun as BarrelProductionGraphRun,
} from '@/seed/types/creative-economy';

const PRODUCTION_EVENT_NAMES = [
  'production.graph.started',
  'production.graph.completed',
  'production.graph.failed',
] as const;

type ProductionEventName = (typeof PRODUCTION_EVENT_NAMES)[number];

/**
 * Compile-time registration guard: resolves to `true` only when every
 * production-graph event name is a key of the merged Events record.
 */
type AllProductionEventsRegistered = [ProductionEventName] extends [keyof Events]
  ? true
  : never;

const allProductionEventsRegistered: AllProductionEventsRegistered = true;

/**
 * Compile-time barrel guard: the creative-economy barrel must re-export the
 * production-factory types identically (both directions, both contracts).
 */
type BarrelMatchesSource = [BarrelProductionGraphRun] extends [ProductionGraphRun]
  ? [ProductionGraphRun] extends [BarrelProductionGraphRun]
    ? [BarrelMissionTypePolicy] extends [MissionTypePolicy]
      ? [MissionTypePolicy] extends [BarrelMissionTypePolicy]
        ? true
        : never
      : never
    : never
  : never;

const barrelMatchesSource: BarrelMatchesSource = true;

/** Run statuses exactly as stored in production_graph_runs.status. */
const RUN_STATUSES: readonly ProductionGraphRunStatus[] = [
  'queued',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
];

/** Run phases exactly as stored in production_graph_runs.phase. */
const RUN_PHASES: readonly ProductionGraphRunPhase[] = [
  'planning',
  'executing',
  'awaiting_approval',
  'publishing',
  'review',
];

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../migrations/0257_production_factory.sql',
);

describe('Production Factory events (Phase 3)', () => {
  describe('schema registration', () => {
    it('all three production-graph event names are keys of Events', () => {
      // Compile-time: allProductionEventsRegistered is `true` only when every
      // production event name is a key of the merged Events record.
      expect(allProductionEventsRegistered).toBe(true);
      expect(PRODUCTION_EVENT_NAMES).toHaveLength(3);
      expect(new Set(PRODUCTION_EVENT_NAMES).size).toBe(3);
    });

    it('creative-economy barrel re-exports production-factory types', () => {
      expect(barrelMatchesSource).toBe(true);
    });

    it('run status and phase unions match the stored column domains', () => {
      expect(RUN_STATUSES).toHaveLength(6);
      expect(RUN_PHASES).toHaveLength(5);
      expect(new Set(RUN_STATUSES).size).toBe(6);
      expect(new Set(RUN_PHASES).size).toBe(5);
    });
  });

  describe('payload round-trip', () => {
    it('production.graph.started payload round-trips through JSON', () => {
      const payload: Events['production.graph.started'] = {
        data: {
          graphRunId: 'graph-run-1',
          graphId: 'graph-1',
          missionId: 'mission-1',
          workspaceId: 'workspace-1',
          missionType: 'article',
          retryCount: 0,
        },
      };
      const roundTripped = JSON.parse(
        JSON.stringify(payload),
      ) as ProductionGraphStartedEvent;
      expect(roundTripped).toEqual(payload);
      expect(roundTripped.data.graphRunId).toBe('graph-run-1');
    });

    it('production.graph.completed payload round-trips through JSON', () => {
      const payload: Events['production.graph.completed'] = {
        data: {
          graphRunId: 'graph-run-2',
          graphId: 'graph-2',
          missionId: 'mission-2',
          workspaceId: 'workspace-2',
          totalCostCents: 1234,
          totalTokens: 56789,
        },
      };
      const roundTripped = JSON.parse(
        JSON.stringify(payload),
      ) as ProductionGraphCompletedEvent;
      expect(roundTripped).toEqual(payload);
      expect(roundTripped.data.totalCostCents).toBe(1234);
    });

    it('production.graph.failed payload round-trips through JSON', () => {
      const payload: Events['production.graph.failed'] = {
        data: {
          graphRunId: 'graph-run-3',
          graphId: 'graph-3',
          missionId: 'mission-3',
          workspaceId: 'workspace-3',
          errorCode: 'RETRIES_EXHAUSTED',
          errorMessage: 'node draft failed after 3 retries',
          retryCount: 3,
        },
      };
      const roundTripped = JSON.parse(
        JSON.stringify(payload),
      ) as ProductionGraphFailedEvent;
      expect(roundTripped).toEqual(payload);
      expect(roundTripped.data.errorCode).toBe('RETRIES_EXHAUSTED');
    });
  });

  describe('graph definition shape', () => {
    it('GraphDefinition admits agentSlug nodes and from/to edges', () => {
      const definition: GraphDefinition = {
        nodes: [
          { id: 'research', agentSlug: 'sophia-researcher' },
          { id: 'draft', agentSlug: 'sophia-content-writer' },
          { id: 'publish', agentSlug: 'sophia-editor', isPublishNode: true },
        ],
        edges: [
          { from: 'research', to: 'draft' },
          { from: 'draft', to: 'publish' },
        ],
      };
      const roundTripped = JSON.parse(
        JSON.stringify(definition),
      ) as GraphDefinition;
      expect(roundTripped.nodes.map((node) => node.agentSlug)).toEqual([
        'sophia-researcher',
        'sophia-content-writer',
        'sophia-editor',
      ]);
      expect(roundTripped.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
        'research->draft',
        'draft->publish',
      ]);
    });
  });

  describe('migration 0257', () => {
    it('migration file exists', () => {
      expect(existsSync(MIGRATION_PATH)).toBe(true);
    });

    it('creates all three production tables with IF NOT EXISTS', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS mission_type_policies');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS production_graphs');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS production_graph_runs');
    });

    it('adds mission_type to creative_missions with general default', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      expect(sql).toContain('ALTER TABLE creative_missions');
      expect(sql).toContain("mission_type TEXT NOT NULL DEFAULT 'general'");
    });

    it('creates the five required indexes', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      for (const indexName of [
        'idx_mtp_workspace',
        'idx_graph_runs_workspace',
        'idx_graph_runs_status',
        'idx_graph_runs_mission',
        'idx_graphs_workspace',
      ]) {
        expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${indexName}`);
      }
    });

    it('enforces the workspace-scoped uniqueness constraints', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      expect(sql).toContain('UNIQUE(workspace_id, mission_type)');
      expect(sql).toContain('UNIQUE(workspace_id, slug)');
    });
  });
});
