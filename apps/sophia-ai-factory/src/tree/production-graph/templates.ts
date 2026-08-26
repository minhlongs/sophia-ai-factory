/**
 * Production Graph — built-in deterministic templates.
 *
 * Three starter graphs shipped per workspace. Every template is a linear
 * DAG with exactly one sink, and the sink is the publish node. Agent slugs
 * reference the graph agents registered by tree/agent-protocol/graph-agents.
 *
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/production-graph/templates
 */

import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { GraphDefinition } from '@/seed/types/production-factory';
import { createGraph, getGraphBySlug, type GraphRepoError } from './repo';

/** A named template: metadata plus its graph definition. */
export interface ProductionGraphTemplate {
  slug: string;
  name: string;
  missionType: string;
  definition: GraphDefinition;
}

/**
 * The three built-in templates. Deterministic constants — same shapes in
 * every workspace. Node ids and agent slugs are stable contracts.
 */
export const GRAPH_TEMPLATES: readonly ProductionGraphTemplate[] = [
  {
    slug: 'article-factory',
    name: 'Article Factory',
    missionType: 'article-factory',
    definition: {
      nodes: [
        { id: 'research', agentSlug: 'sophia-researcher', name: 'Research' },
        { id: 'draft', agentSlug: 'sophia-editor', name: 'Draft' },
        { id: 'polish', agentSlug: 'sophia-editor', name: 'Polish & Publish', isPublishNode: true },
      ],
      edges: [
        { from: 'research', to: 'draft' },
        { from: 'draft', to: 'polish' },
      ],
    },
  },
  {
    slug: 'video-brief',
    name: 'Video Brief',
    missionType: 'video-brief',
    definition: {
      nodes: [
        { id: 'research', agentSlug: 'sophia-researcher', name: 'Research' },
        { id: 'script-brief', agentSlug: 'sophia-strategist', name: 'Script Brief' },
        {
          id: 'thumbnail-copy',
          agentSlug: 'sophia-strategist',
          name: 'Thumbnail Copy & Publish',
          isPublishNode: true,
        },
      ],
      edges: [
        { from: 'research', to: 'script-brief' },
        { from: 'script-brief', to: 'thumbnail-copy' },
      ],
    },
  },
  {
    slug: 'repurpose-derivative',
    name: 'Repurpose Derivative',
    missionType: 'repurpose-derivative',
    definition: {
      nodes: [
        { id: 'summarize', agentSlug: 'sophia-editor', name: 'Summarize' },
        { id: 'thread', agentSlug: 'sophia-strategist', name: 'Thread' },
        { id: 'newsletter', agentSlug: 'sophia-editor', name: 'Newsletter & Publish', isPublishNode: true },
      ],
      edges: [
        { from: 'summarize', to: 'thread' },
        { from: 'thread', to: 'newsletter' },
      ],
    },
  },
];

/** Deterministic graph id for a workspace template. */
export function templateGraphId(workspaceId: string, slug: string): string {
  return `graph_${workspaceId}_${slug}`;
}

/**
 * Idempotently seed the built-in templates for a workspace. Existing slugs
 * are left untouched; only missing templates are inserted. Returns the
 * number of templates newly created.
 */
export async function ensureTemplatesSeeded(
  workspaceId: string,
): Promise<Result<{ seeded: number }, GraphRepoError>> {
  let seeded = 0;
  for (const template of GRAPH_TEMPLATES) {
    const existing = await getGraphBySlug(workspaceId, template.slug);
    if (!existing.ok) return failure(existing.error);
    if (existing.value) continue;

    const created = await createGraph(workspaceId, {
      id: templateGraphId(workspaceId, template.slug),
      missionType: template.missionType,
      slug: template.slug,
      name: template.name,
      definition: template.definition,
      isTemplate: true,
    });
    if (!created.ok) {
      // A concurrent seeder may have inserted between read and write —
      // treat CONFLICT as already-seeded, anything else is a real failure.
      if (created.error.code === 'CONFLICT') continue;
      logger.error('[GraphTemplates] seeding failed', {
        error: created.error.message,
        workspaceId,
        slug: template.slug,
      });
      return failure(created.error);
    }
    seeded += 1;
  }
  return success({ seeded });
}
