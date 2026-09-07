/**
 * Phase 1.6 — Inngest client merge guard.
 *
 * Proves the strangler consolidation holds: every legacy import path resolves
 * to the ONE canonical seed client, the merged schema carries all 40 event
 * keys, and the rich agent.mission.started payload is wired into the record.
 *
 * Uses the real exported instances — no mocks that fake the client.
 *
 * @module seed/inngest/__tests__/client-merge.test
 */

import { describe, it, expect } from 'vitest';

import { inngest as seedClient } from '@/seed/inngest/client';
import { inngest as treeClient } from '@/tree/inngest/client';
import { inngest as treeBarrelClient } from '@/tree/inngest';
import { inngest as forestClient } from '@/forest/inngest/client';
import type { Events } from '@/seed/inngest/event-types';

/**
 * Source of truth for the merged schema's event keys: the 28 former seed
 * events, the 5 agent-mission events absorbed from the tree client, the
 * 4 production-graph events added for the autonomous production factory
 * (started/completed/failed/cancelled), the revenue/event.recorded event
 * added for revenue ingestion, and the commerce/payment.confirmed event
 * added for digital product commerce.
 */
const EXPECTED_EVENT_KEYS = [
  'campaign.created',
  'campaign.progress',
  'test/hello.world',
  'key.rotation.requested',
  'url_revenue.video.requested',
  'video.requested',
  'video.script.ready',
  'video.tts.ready',
  'video.visual.ready',
  'video.composed',
  'video.uploaded',
  'video.published',
  'publish.scheduled',
  'publish.token.refresh',
  'video/generate.requested',
  'batch/video.fanout',
  'sop/execution.requested',
  'sop/step.completed',
  'repurpose/analyze.requested',
  'repurpose/clip.generate',
  'analytics/sync.requested',
  'conversion.created',
  'distribution/plan.created',
  'commission.matured',
  'revenue/event.recorded',
  'commerce/payment.confirmed',
  'payout.batched',
  'payout.confirmed',
  'payout.reconcile.alert',
  'creative-memory/signal-accumulated',
  'youtube.content.pipeline.requested',
  'agent.mission.started',
  'agent.approval.requested',
  'agent.approval.resolved',
  'agent.mission.completed',
  'agent.mission.failed',
  'production.graph.started',
  'production.graph.completed',
  'production.graph.failed',
  'production.graph.cancelled',
] as const;

type ExpectedKey = (typeof EXPECTED_EVENT_KEYS)[number];
type ActualKey = keyof Events;

/**
 * Compile-time exactness guard: resolves to `true` only when `keyof Events`
 * and the expected key union are identical in both directions. Any schema
 * drift (missing or extra key) collapses this to `never` and fails tsc.
 */
type KeysAreExact = [ExpectedKey] extends [ActualKey]
  ? [ActualKey] extends [ExpectedKey]
    ? true
    : never
  : never;

const keysAreExact: KeysAreExact = true;

describe('Inngest client merge (Phase 1.6)', () => {
  describe('single canonical instance', () => {
    it('tree client re-exports the seed client instance', () => {
      expect(treeClient).toBe(seedClient);
    });

    it('tree barrel re-exports the seed client instance', () => {
      expect(treeBarrelClient).toBe(seedClient);
    });

    it('forest client re-exports the seed client instance', () => {
      expect(forestClient).toBe(seedClient);
    });
  });

  describe('merged schema completeness', () => {
    it('expected key list holds exactly 40 unique event keys', () => {
      expect(EXPECTED_EVENT_KEYS).toHaveLength(40);
      expect(new Set(EXPECTED_EVENT_KEYS).size).toBe(40);
    });

    it('Events record key set exactly matches the 40 expected keys', () => {
      // Compile-time: keysAreExact is `true` only if keyof Events === expected.
      expect(keysAreExact).toBe(true);
    });
  });

  describe('agent event richness', () => {
    it('agent.mission.started payload accepts autonomyLevel + inputJson', () => {
      // Type-level: the merged record entry must admit the rich payload.
      const payload: Events['agent.mission.started'] = {
        data: {
          runId: 'run-1',
          agentId: 'agent-1',
          missionId: 'mission-1',
          workspaceId: 'workspace-1',
          autonomyLevel: 2,
          inputJson: { goal: 'publish', retries: 1 },
        },
      };
      expect(payload.data.autonomyLevel).toBe(2);
      expect(payload.data.inputJson).toEqual({ goal: 'publish', retries: 1 });
    });

    it('agent.mission.started remains valid without the optional fields', () => {
      const payload: Events['agent.mission.started'] = {
        data: {
          runId: 'run-2',
          agentId: 'agent-2',
          missionId: 'mission-2',
          workspaceId: 'workspace-2',
        },
      };
      expect(payload.data.autonomyLevel).toBeUndefined();
      expect(payload.data.inputJson).toBeUndefined();
    });
  });

  describe('app identity', () => {
    it('canonical client carries the sophia-ai-factory app id', () => {
      expect(seedClient.id).toBe('sophia-ai-factory');
    });

    it('canonical client is a live Inngest-shaped object', () => {
      expect(typeof seedClient.send).toBe('function');
    });
  });
});
