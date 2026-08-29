/**
 * Production Graph templates — unit tests.
 *
 * Covers: template constant contracts (4 templates, unique slugs, linear DAG
 * shape, exactly one publish sink per template, registered agent slugs),
 * templateGraphId format, and ensureTemplatesSeeded behavior (fresh seed,
 * idempotent re-seed, partial seed, CONFLICT tolerance, error propagation).
 *
 * @module tree/production-graph/__tests__/templates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGraphBySlug: vi.fn(),
  createGraph: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../repo', () => ({
  getGraphBySlug: (...args: unknown[]) => mocks.getGraphBySlug(...args),
  createGraph: (...args: unknown[]) => mocks.createGraph(...args),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

import type { GraphRepoError } from '../repo';
import type { ProductionGraph } from '@/seed/types/production-factory';
import { validateGraphDefinition } from '../validate';
import {
  GRAPH_TEMPLATES,
  templateGraphId,
  ensureTemplatesSeeded,
} from '../templates';

const KNOWN_SLUGS = new Set([
  'sophia-researcher',
  'sophia-editor',
  'sophia-strategist',
  'sophia-scout',
  'sophia-creative-director',
  'sophia-writer',
  'sophia-storyboard',
  'sophia-production',
  'sophia-qa',
  'sophia-provenance',
  'sophia-distribution-plan',
  'sophia-performance',
  'sophia-learning',
]);

function makeStoredGraph(workspaceId: string, slug: string): ProductionGraph {
  return {
    id: templateGraphId(workspaceId, slug),
    workspaceId,
    missionType: slug,
    slug,
    name: slug,
    definition: { nodes: [], edges: [] },
    isTemplate: true,
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
  };
}

describe('GRAPH_TEMPLATES constants', () => {
  it('ships exactly four templates with unique slugs', () => {
    expect(GRAPH_TEMPLATES).toHaveLength(4);
    const slugs = GRAPH_TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(4);
    expect(slugs).toEqual(['article-factory', 'video-brief', 'repurpose-derivative', 'creative-mission-full']);
  });

  it('every template has a non-empty name and matching missionType', () => {
    for (const template of GRAPH_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.missionType).toBe(template.slug);
    }
  });

  it('every template is a valid graph against the registered graph agent slugs', () => {
    for (const template of GRAPH_TEMPLATES) {
      const result = validateGraphDefinition(template.definition, KNOWN_SLUGS);
      expect(result.ok, `template ${template.slug} must validate`).toBe(true);
      if (!result.ok) continue;
      // Linear DAG: exactly one sink.
      expect(result.value.sinkIds).toHaveLength(1);
      // The sink is the publish node for simple templates; for creative-mission-full,
      // Human Approval is the publish gate (middle) and Learning is the sink.
      const sinkId = result.value.sinkIds[0];
      const sinkNode = template.definition.nodes.find((n) => n.id === sinkId);
      const publishNodes = template.definition.nodes.filter((n) => n.isPublishNode === true);
      if (template.slug === 'creative-mission-full') {
        // Human Approval is the publish/gate node; Learning is the sink.
        expect(publishNodes.map((n) => n.id)).toEqual(['human-approval']);
      } else {
        expect(sinkNode?.isPublishNode).toBe(true);
      }
    }
  });

  it('every template has exactly one publish node and no duplicate node ids', () => {
    for (const template of GRAPH_TEMPLATES) {
      const publishNodes = template.definition.nodes.filter((n) => n.isPublishNode === true);
      expect(publishNodes).toHaveLength(1);
      const ids = template.definition.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every edge references existing nodes within its template', () => {
    for (const template of GRAPH_TEMPLATES) {
      const ids = new Set(template.definition.nodes.map((n) => n.id));
      for (const edge of template.definition.edges) {
        expect(ids.has(edge.from), `${template.slug}: edge from ${edge.from}`).toBe(true);
        expect(ids.has(edge.to), `${template.slug}: edge to ${edge.to}`).toBe(true);
      }
    }
  });
});

describe('templateGraphId', () => {
  it('builds a deterministic id from workspace and slug', () => {
    expect(templateGraphId('ws_123', 'article-factory')).toBe('graph_ws_123_article-factory');
  });

  it('is a pure function — same inputs, same output', () => {
    expect(templateGraphId('ws_a', 'video-brief')).toBe(templateGraphId('ws_a', 'video-brief'));
  });
});

describe('ensureTemplatesSeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds all four templates on a fresh workspace', async () => {
    mocks.getGraphBySlug.mockResolvedValue({ ok: true, value: null });
    mocks.createGraph.mockImplementation(async (workspaceId: string, input: { slug: string }) => ({
      ok: true,
      value: makeStoredGraph(workspaceId, input.slug),
    }));

    const result = await ensureTemplatesSeeded('ws_fresh');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seeded).toBe(4);
    expect(mocks.createGraph).toHaveBeenCalledTimes(4);

    // Each create call carries the deterministic id, template flag, and definition.
    for (let i = 0; i < GRAPH_TEMPLATES.length; i += 1) {
      const template = GRAPH_TEMPLATES[i];
      if (!template) continue;
      const call = mocks.createGraph.mock.calls[i];
      expect(call?.[0]).toBe('ws_fresh');
      const input = call?.[1] as {
        id: string;
        slug: string;
        name: string;
        missionType: string;
        isTemplate: boolean;
      };
      expect(input.id).toBe(templateGraphId('ws_fresh', template.slug));
      expect(input.slug).toBe(template.slug);
      expect(input.name).toBe(template.name);
      expect(input.missionType).toBe(template.missionType);
      expect(input.isTemplate).toBe(true);
    }
  });

  it('is idempotent — existing templates are left untouched', async () => {
    mocks.getGraphBySlug.mockImplementation(async (workspaceId: string, slug: string) => ({
      ok: true,
      value: makeStoredGraph(workspaceId, slug),
    }));

    const result = await ensureTemplatesSeeded('ws_seeded');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seeded).toBe(0);
    expect(mocks.createGraph).not.toHaveBeenCalled();
    expect(mocks.getGraphBySlug).toHaveBeenCalledTimes(4);
  });

  it('seeds only the missing templates on a partially seeded workspace', async () => {
    mocks.getGraphBySlug.mockImplementation(async (workspaceId: string, slug: string) => ({
      ok: true,
      value: slug === 'article-factory' ? makeStoredGraph(workspaceId, slug) : null,
    }));
    mocks.createGraph.mockImplementation(async (workspaceId: string, input: { slug: string }) => ({
      ok: true,
      value: makeStoredGraph(workspaceId, input.slug),
    }));

    const result = await ensureTemplatesSeeded('ws_partial');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seeded).toBe(3);
    const createdSlugs = mocks.createGraph.mock.calls.map(
      (call) => (call[1] as { slug: string }).slug,
    );
    expect(createdSlugs).toEqual(['video-brief', 'repurpose-derivative', 'creative-mission-full']);
  });

  it('treats a CONFLICT on create as already-seeded and continues', async () => {
    mocks.getGraphBySlug.mockResolvedValue({ ok: true, value: null });
    const conflict: GraphRepoError = {
      code: 'CONFLICT',
      message: 'UNIQUE constraint failed: production_graphs.workspace_id, production_graphs.slug',
    };
    mocks.createGraph.mockImplementation(async (workspaceId: string, input: { slug: string }) => {
      if (input.slug === 'video-brief') return { ok: false, error: conflict };
      return { ok: true, value: makeStoredGraph(workspaceId, input.slug) };
    });

    const result = await ensureTemplatesSeeded('ws_race');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // CONFLICT counts as already present, not as newly seeded.
    expect(result.value.seeded).toBe(3);
    expect(mocks.createGraph).toHaveBeenCalledTimes(4);
  });

  it('propagates a non-CONFLICT create failure', async () => {
    mocks.getGraphBySlug.mockResolvedValue({ ok: true, value: null });
    const dbError: GraphRepoError = { code: 'DB_ERROR', message: 'disk full' };
    mocks.createGraph.mockResolvedValue({ ok: false, error: dbError });

    const result = await ensureTemplatesSeeded('ws_fail');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_ERROR');
    expect(result.error.message).toBe('disk full');
    // Stops at the first failing template — no further create attempts.
    expect(mocks.createGraph).toHaveBeenCalledTimes(1);
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it('propagates a getGraphBySlug read failure', async () => {
    const readError: GraphRepoError = { code: 'DB_UNAVAILABLE', message: 'D1 binding missing' };
    mocks.getGraphBySlug.mockResolvedValue({ ok: false, error: readError });

    const result = await ensureTemplatesSeeded('ws_unreadable');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_UNAVAILABLE');
    expect(mocks.createGraph).not.toHaveBeenCalled();
  });
});