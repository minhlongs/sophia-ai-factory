/**
 * Production Graph — Design Partner mission template bundles.
 *
 * PHASE D (Reality Loop v1): 3 archetype bundles as PURE DATA. Metadata route
 * only — zero engine change, zero runner change, zero new approval types.
 * Each bundle references an existing GRAPH_TEMPLATES definition (validated by
 * the existing validateGraphDefinition) and is flattened into the existing
 * mission-create inputs: constraints / successMetrics / autonomyLevel.
 *
 * Success metrics are a SUBSET of SOPHIA_VALUE_SCORECARD metric names
 * (docs/reality-loop/SOPHIA_VALUE_SCORECARD.md). Autonomy levels use the
 * existing AutonomyLevel enum (0-4). Approval maps to the existing
 * publish_content tool with requiresApproval=true (graph-agents.ts).
 *
 * Layer: tree (domain-specific reusable).
 * @module tree/production-graph/design-partner-bundles
 */

import { failure, success, type Result } from '@/seed/types/result';
import type { AutonomyLevel } from '@/seed/types/creative-domain';
import { GRAPH_TEMPLATES, type ProductionGraphTemplate } from './templates';

/** The three design-partner archetypes. */
export type DesignPartnerArchetype = 'FOUNDER' | 'AGENCY' | 'CREATOR';

/** Existing approval tool id — no new approval types are introduced. */
export const PUBLISH_APPROVAL_TOOL = 'publish_content';

/**
 * Canonical metric vocabulary from SOPHIA_VALUE_SCORECARD.md.
 * Bundle successMetrics keys MUST be a subset of these names.
 */
export const SCORECARD_METRIC_NAMES: ReadonlySet<string> = new Set([
  'median_human_time_per_approval',
  'median_mission_wall_clock_minutes',
  'machine_vs_manual_ratio',
  'human_time_without_sophia',
  'human_time_with_sophia',
  'suggestions_proposed',
  'suggestions_accepted',
  'suggestions_edited',
  'suggestions_rejected',
  'acceptance_rate',
  'mission_started',
  'mission_completed',
  'mission_abandoned',
  'mission_resumed',
  'completion_rate',
  'approval_required',
  'approval_granted',
  'approval_rejected',
  'human_override',
  'intervention_ratio',
  'memory_used',
  'memory_helpful',
  'memory_corrected',
  'memory_rejected',
  'correction_rate',
  'leads',
  'conversions',
  'revenue',
  'creative_cost',
  'estimated_roi',
  'agent_action_success_rate',
  'retry_rate',
  'human_correction_rate',
  'rollback_rate',
  'mission_cost',
  'agent_cost',
  'model_cost',
  'cost_per_completed_mission',
]);

/** Approval policy — maps 1:1 onto the existing publish gate mechanism. */
export interface BundleApprovalPolicy {
  /** Existing tool id only: publish_content. */
  tool: typeof PUBLISH_APPROVAL_TOOL;
  /** True = human approves before publish (existing requiresApproval flag). */
  requiresApproval: boolean;
}

/** A design-partner mission template bundle. Pure data — no behavior. */
export interface DesignPartnerBundle {
  slug: string;
  archetype: DesignPartnerArchetype;
  name: string;
  /** Bilingual display names for the non-technical CEO audience. */
  nameVi: string;
  nameEn: string;
  /** Mission objective (EN, CEO-readable, no jargon). */
  objective: string;
  /** Flattened into mission.constraints at create time. */
  constraints: Record<string, unknown>;
  /** Subset of SCORECARD_METRIC_NAMES -> numeric target. */
  successMetrics: Record<string, number>;
  /** Existing AutonomyLevel enum value (0-4). */
  autonomyLevel: AutonomyLevel;
  approvalPolicy: BundleApprovalPolicy;
  /** GRAPH_TEMPLATES slug this bundle drives. */
  graphTemplateSlug: string;
  /** Copied from the referenced template — zero engine change. */
  missionType: string;
}

/**
 * The three bundles. Deterministic constants — same data in every workspace.
 * Targets mirror SOPHIA_VALUE_SCORECARD group targets verbatim.
 */
export const DESIGN_PARTNER_BUNDLES: readonly DesignPartnerBundle[] = [
  {
    slug: 'founder-media-engine',
    archetype: 'FOUNDER',
    name: 'Founder Media Engine',
    nameVi: 'Cỗ Máy Truyền Thông Cá Nhân',
    nameEn: 'Founder Media Engine',
    objective:
      'Run a consistent personal content engine without hiring a team — Sophia produces, you approve each publish.',
    constraints: {
      toneOfVoice: 'personal-founder',
      language: 'vi-en',
      maxBudgetCentsPerMission: 500,
      contentVolumePerWeek: 3,
    },
    successMetrics: {
      machine_vs_manual_ratio: 5,
      median_human_time_per_approval: 120,
      completion_rate: 0.7,
      correction_rate: 0.1,
    },
    autonomyLevel: 2,
    approvalPolicy: { tool: PUBLISH_APPROVAL_TOOL, requiresApproval: true },
    graphTemplateSlug: 'creative-mission-full',
    missionType: 'creative-mission-full',
  },
  {
    slug: 'agency-creative-ops',
    archetype: 'AGENCY',
    name: 'Agency Creative Operations',
    nameVi: 'Vận Hành Sáng Tác Đa Khách Hàng',
    nameEn: 'Agency Creative Operations',
    objective:
      'Serve multiple clients with one creative pipeline — keep client-facing quality gates and cost under control.',
    constraints: {
      clientFacingQualityGate: true,
      language: 'vi-en',
      maxBudgetCentsPerMission: 500,
      reviewRoundsMax: 2,
    },
    successMetrics: {
      acceptance_rate: 0.6,
      intervention_ratio: 2.0,
      agent_action_success_rate: 0.85,
      cost_per_completed_mission: 500,
    },
    autonomyLevel: 2,
    approvalPolicy: { tool: PUBLISH_APPROVAL_TOOL, requiresApproval: true },
    graphTemplateSlug: 'creative-mission-full',
    missionType: 'creative-mission-full',
  },
  {
    slug: 'creator-audience-engine',
    archetype: 'CREATOR',
    name: 'Creator Audience Engine',
    nameVi: 'Cỗ Máy Tăng Trưởng Khán Giả',
    nameEn: 'Creator Audience Engine',
    objective:
      'Grow audience by repurposing every asset into derivative content — maximize reach per idea, faster iteration.',
    constraints: {
      toneOfVoice: 'authentic-creator',
      language: 'vi-en',
      maxBudgetCentsPerMission: 500,
      derivativeFormatsPerAsset: 2,
    },
    successMetrics: {
      machine_vs_manual_ratio: 5,
      acceptance_rate: 0.6,
      completion_rate: 0.7,
      estimated_roi: 1.0,
    },
    autonomyLevel: 3,
    approvalPolicy: { tool: PUBLISH_APPROVAL_TOOL, requiresApproval: true },
    graphTemplateSlug: 'repurpose-derivative',
    missionType: 'repurpose-derivative',
  },
];

/** Validation failure codes — stable contract for callers and tests. */
export type BundleValidationError =
  | { code: 'UNKNOWN_TEMPLATE'; message: string; slug: string }
  | { code: 'METRIC_NOT_IN_SCORECARD'; message: string; metric: string }
  | { code: 'BAD_AUTONOMY_LEVEL'; message: string; level: number }
  | { code: 'BAD_APPROVAL_POLICY'; message: string };

/**
 * Validate a bundle against the existing template set and scorecard
 * vocabulary. Pure and deterministic. Does NOT re-run graph validation —
 * the referenced template is already validated by validateGraphDefinition
 * (see __tests__/design-partner-bundles.test.ts).
 */
export function validateDesignPartnerBundle(
  bundle: DesignPartnerBundle,
  templates: readonly ProductionGraphTemplate[] = GRAPH_TEMPLATES,
): Result<DesignPartnerBundle, BundleValidationError> {
  const template = templates.find((t) => t.slug === bundle.graphTemplateSlug);
  if (!template) {
    return failure({
      code: 'UNKNOWN_TEMPLATE',
      message: `Bundle ${bundle.slug} references unknown template ${bundle.graphTemplateSlug}`,
      slug: bundle.graphTemplateSlug,
    });
  }
  for (const metric of Object.keys(bundle.successMetrics)) {
    if (!SCORECARD_METRIC_NAMES.has(metric)) {
      return failure({
        code: 'METRIC_NOT_IN_SCORECARD',
        message: `Bundle ${bundle.slug} metric ${metric} is not in the scorecard vocabulary`,
        metric,
      });
    }
  }
  if (
    !Number.isInteger(bundle.autonomyLevel) ||
    bundle.autonomyLevel < 0 ||
    bundle.autonomyLevel > 4
  ) {
    return failure({
      code: 'BAD_AUTONOMY_LEVEL',
      message: `Bundle ${bundle.slug} autonomyLevel must be 0-4, got ${bundle.autonomyLevel}`,
      level: bundle.autonomyLevel,
    });
  }
  if (
    bundle.approvalPolicy.tool !== PUBLISH_APPROVAL_TOOL ||
    bundle.approvalPolicy.requiresApproval !== true
  ) {
    return failure({
      code: 'BAD_APPROVAL_POLICY',
      message: `Bundle ${bundle.slug} must use the existing publish_content gate`,
    });
  }
  return success(bundle);
}
