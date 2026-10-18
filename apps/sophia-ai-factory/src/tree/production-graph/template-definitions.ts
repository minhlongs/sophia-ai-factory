/**
 * Production Graph — Built-in Template Definitions
 * Layer: tree/production-graph
 *
 * @module tree/production-graph/template-definitions
 */

import type { GraphDefinition } from '@/seed/types/production-factory';

/** A named template: metadata plus its graph definition. */
export interface ProductionGraphTemplate {
  slug: string;
  name: string;
  missionType: string;
  definition: GraphDefinition;
}

/**
 * The four built-in templates. Deterministic constants — same shapes in
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
  {
    slug: 'creative-mission-full',
    name: 'Creative Mission Full',
    missionType: 'creative-mission-full',
    definition: {
      nodes: [
        { id: 'scout', agentSlug: 'sophia-scout', name: 'Scout' },
        { id: 'research', agentSlug: 'sophia-researcher', name: 'Research' },
        { id: 'strategy', agentSlug: 'sophia-strategist', name: 'Strategy' },
        { id: 'creative-director', agentSlug: 'sophia-creative-director', name: 'Creative Director' },
        { id: 'writer', agentSlug: 'sophia-writer', name: 'Writer' },
        { id: 'storyboard', agentSlug: 'sophia-storyboard', name: 'Storyboard' },
        { id: 'production', agentSlug: 'sophia-production', name: 'Production' },
        { id: 'qa', agentSlug: 'sophia-qa', name: 'QA' },
        { id: 'provenance', agentSlug: 'sophia-provenance', name: 'Provenance' },
        { id: 'human-approval', agentSlug: 'sophia-editor', name: 'Human Approval', isPublishNode: true },
        { id: 'distribution-plan', agentSlug: 'sophia-distribution-plan', name: 'Distribution Plan' },
        { id: 'performance', agentSlug: 'sophia-performance', name: 'Performance' },
        { id: 'learning', agentSlug: 'sophia-learning', name: 'Learning' },
      ],
      edges: [
        { from: 'scout', to: 'research' },
        { from: 'research', to: 'strategy' },
        { from: 'strategy', to: 'creative-director' },
        { from: 'creative-director', to: 'writer' },
        { from: 'writer', to: 'storyboard' },
        { from: 'storyboard', to: 'production' },
        { from: 'production', to: 'qa' },
        { from: 'qa', to: 'provenance' },
        { from: 'provenance', to: 'human-approval' },
        { from: 'human-approval', to: 'distribution-plan' },
        { from: 'distribution-plan', to: 'performance' },
        { from: 'performance', to: 'learning' },
      ],
    },
  },
];
