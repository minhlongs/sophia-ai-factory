/**
 * supervisor-steps.ts — Workflow step definitions (pluggable)
 *
 * Exports:
 * - SUPERVISOR_STEPS: default 3-step MVP chain (backward compatible)
 * - WORKFLOW_PRESETS: registry of named workflow presets
 * - getStepsForPreset(): lookup steps by preset name
 */

// ── Default MVP steps (backward compatible) ───────────────────────────────────

export const SUPERVISOR_STEPS = [
  { order: 1, type: 'create_plan', command: 'supervisor.plan' },
  { order: 2, type: 'execute_development', command: 'supervisor.execute' },
  { order: 3, type: 'run_tests', command: 'supervisor.test' },
] as const

export type SupervisorStepType = typeof SUPERVISOR_STEPS[number]['type']

export function getStep(order: 1 | 2 | 3) {
  return SUPERVISOR_STEPS[order - 1]
}

// ── Workflow Preset Registry ──────────────────────────────────────────────────

export interface WorkflowStep {
  order: number
  type: string
  command: string
  /** For parallel mode: group ID — steps in same group run concurrently */
  parallelGroup?: number
  /** For parallel mode: steps this one depends on (order values) */
  dependsOn?: number[]
  /** Human-readable label for UI */
  label?: { en: string; vi: string }
}

export interface WorkflowPreset {
  id: string
  name: string
  description: string
  goal?: string
  targetScore?: number
  mode: 'linear' | 'parallel' | 'auto'
  steps: WorkflowStep[]
  /** Default specialist roles for Solo Company mode */
  soloRoles?: string[]
}

/**
 * Registry of available workflow presets.
 * Add new presets here to make them available in the UI / API.
 */
export const WORKFLOW_PRESETS: Record<string, WorkflowPreset> = {
  // ── Default: 3-step linear MVP (backward compatible) ─────────────────────
  default: {
    id: 'default',
    name: 'Default Supervisor',
    description: 'Standard 3-step plan → develop → test workflow',
    mode: 'linear',
    steps: [
      { order: 1, type: 'create_plan', command: 'supervisor.plan' },
      { order: 2, type: 'execute_development', command: 'supervisor.execute' },
      { order: 3, type: 'run_tests', command: 'supervisor.test' },
    ],
  },

  // ── CEO Solo Media: $1M MRR goal, parallel execution ────────────────────
  'ceo-solo-media': {
    id: 'ceo-solo-media',
    name: 'CEO Solo Media',
    description: 'AI-powered media company targeting $1M MRR — parallel execution',
    goal: '$1,000,000 MRR',
    targetScore: 100,
    mode: 'parallel',
    soloRoles: ['ceo', 'marketer', 'analyst', 'ops'],
    steps: [
      // Phase 1: Research (parallel)
      {
        order: 1,
        type: 'market_research',
        command: 'solo.ceo.market_research',
        parallelGroup: 1,
        label: {
          en: 'Market Research & Competitive Analysis',
          vi: 'Nghiên cứu thị trường & phân tích đối thủ',
        },
      },
      {
        order: 2,
        type: 'audience_analysis',
        command: 'solo.analyst.audience',
        parallelGroup: 1,
        label: {
          en: 'Audience Segmentation & Persona Building',
          vi: 'Phân khúc khán giả & xây dựng persona',
        },
      },
      // Phase 2: Strategy (depends on Phase 1)
      {
        order: 3,
        type: 'content_strategy',
        command: 'solo.marketer.content_strategy',
        parallelGroup: 2,
        dependsOn: [1, 2],
        label: {
          en: 'Content Strategy & Pillar Planning',
          vi: 'Chiến lược nội dung & kế hoạch trụ cột',
        },
      },
      {
        order: 4,
        type: 'monetization_blueprint',
        command: 'solo.ceo.monetization',
        dependsOn: [1, 2],
        parallelGroup: 2,
        label: {
          en: 'Monetization Blueprint — Revenue Streams',
          vi: 'Kế hoạch kiếm tiền — kênh doanh thu',
        },
      },
      // Phase 3: Production & Distribution (parallel, depends on Phase 2)
      {
        order: 5,
        type: 'content_production',
        command: 'solo.marketer.production',
        dependsOn: [3, 4],
        parallelGroup: 3,
        label: {
          en: 'Content Production Pipeline',
          vi: 'Quy trình sản xuất nội dung',
        },
      },
      {
        order: 6,
        type: 'distribution_setup',
        command: 'solo.ops.distribution',
        dependsOn: [3, 4],
        parallelGroup: 3,
        label: {
          en: 'Multi-Channel Distribution Setup',
          vi: 'Thiết lập phân phối đa kênh',
        },
      },
      // Phase 4: Analytics & Optimization (final)
      {
        order: 7,
        type: 'analytics_dashboard',
        command: 'solo.analyst.dashboard',
        dependsOn: [5, 6],
        label: {
          en: 'Analytics Dashboard & MRR Tracking',
          vi: 'Bảng phân tích & theo dõi MRR',
        },
      },
      {
        order: 8,
        type: 'optimization_loop',
        command: 'solo.ceo.optimize',
        dependsOn: [7],
        label: {
          en: 'Continuous Optimization Loop',
          vi: 'Vòng tối ưu hóa liên tục',
        },
      },
    ],
  },
}

/**
 * Get steps for a named preset. Falls back to SUPERVISOR_STEPS if not found.
 */
export function getStepsForPreset(presetName: string): WorkflowStep[] {
  const preset = WORKFLOW_PRESETS[presetName]
  if (!preset) return SUPERVISOR_STEPS as unknown as WorkflowStep[]
  return preset.steps
}

/**
 * Get preset metadata by name.
 */
export function getPreset(presetName: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS[presetName]
}

/**
 * List all available preset names.
 */
export function listPresetNames(): string[] {
  return Object.keys(WORKFLOW_PRESETS)
}
