import type { AutonomyLevel } from '@/seed/types/creative-domain';

/** The three design-partner archetypes. */
export type DesignPartnerArchetype = 'FOUNDER' | 'AGENCY' | 'CREATOR';

/** Existing approval tool id — no new approval types are introduced. */
export const PUBLISH_APPROVAL_TOOL = 'publish_content';

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

/** Validation failure codes — stable contract for callers and tests. */
export type BundleValidationError =
  | { code: 'UNKNOWN_TEMPLATE'; message: string; slug: string }
  | { code: 'METRIC_NOT_IN_SCORECARD'; message: string; metric: string }
  | { code: 'BAD_AUTONOMY_LEVEL'; message: string; level: number }
  | { code: 'BAD_APPROVAL_POLICY'; message: string };
