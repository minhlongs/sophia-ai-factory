import { PUBLISH_APPROVAL_TOOL, type DesignPartnerBundle } from './types';

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
