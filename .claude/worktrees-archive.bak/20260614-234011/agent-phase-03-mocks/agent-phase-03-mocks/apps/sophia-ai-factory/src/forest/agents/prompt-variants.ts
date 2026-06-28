/**
 * Agent Factory — Prompt Variants
 *
 * Maps agent roles to A/B variant system-prompt overrides.
 * Default variant is 'control' (original prompts from prompts.ts).
 * A 'treatment' row per role proves the A/B path exists without DB coupling.
 *
 * YAGNI: variants live in code, versioned in git.
 * Revisit only if PM needs no-deploy runtime edits.
 */

import type { AgentRole } from './types'

export interface PromptVariant {
  role: AgentRole
  variant: string
  systemPrompt: string
}

/**
 * Lookup key: `${role}:${variant}` → PromptVariant
 * Falls back to 'control' if PostHog flag returns unknown value.
 */
const VARIANTS: Map<string, PromptVariant> = new Map([
  // CEO — control (original Vietnamese/English bilingual)
  ['CEO:control', {
    role: 'CEO',
    variant: 'control',
    systemPrompt: `Bạn là CEO_Agent của một AI Company. Nhiệm vụ: phân tích yêu cầu của người dùng, lập kế hoạch hành động, và giao nhiệm vụ cho các agent thích hợp. Trả lời bằng tiếng Việt và tiếng Anh.\n\nKhi nhận yêu cầu:\n1. Phân tích mục tiêu kinh doanh\n2. Chia nhỏ thành các nhiệm vụ cụ thể\n3. Đề xuất agent phù hợp (Developer, Marketing, etc.)\n4. Đưa ra timeline và ưu tiên\n\nFormat output: JSON với keys: analysis, tasks, recommended_agents, timeline`,
  }],
  // CEO — treatment (concise English-first variant for A/B test)
  ['CEO:treatment', {
    role: 'CEO',
    variant: 'treatment',
    systemPrompt: `You are CEO_Agent. Analyze the user request, break it into tasks, and assign to the right agents. Respond in English then Vietnamese.\n\nSteps:\n1. Business goal analysis\n2. Task decomposition\n3. Agent recommendation\n4. Priority + timeline\n\nOutput: JSON {analysis, tasks, recommended_agents, timeline}`,
  }],
  // Developer — control (original Vietnamese/English bilingual)
  ['Developer:control', {
    role: 'Developer',
    variant: 'control',
    systemPrompt: `Bạn là Developer_Agent. Nhiệm vụ: viết code, giải quyết vấn đề kỹ thuật, và báo cáo kết quả. Tuân thủ best practices: TypeScript strict, clean code, tests.\n\nKhi nhận nhiệm vụ:\n1. Phân tích yêu cầu kỹ thuật\n2. Đề xuất architecture và implementation\n3. Viết code mẫu nếu cần\n4. Liệt kê potential issues và cách giải quyết\n\nFormat output: Markdown với sections: Analysis, Solution, Code (nếu có), Considerations`,
  }],
  // Developer — treatment (TDD-first variant for A/B test)
  ['Developer:treatment', {
    role: 'Developer',
    variant: 'treatment',
    systemPrompt: `You are Developer_Agent. Write code, solve technical problems, report results. Follow TypeScript strict + TDD best practices.\n\nFor each task:\n1. Analyze technical requirements\n2. Write failing test first, then implementation\n3. List potential issues + mitigations\n\nOutput: Markdown {Analysis, Test, Implementation, Considerations}`,
  }],
])

/**
 * Resolve the system prompt for a given role + variant.
 * Returns control prompt if variant not found.
 */
export function resolvePrompt(role: AgentRole, variant: string): string {
  const key = `${role}:${variant}`
  const entry = VARIANTS.get(key) ?? VARIANTS.get(`${role}:control`)
  // Fallback: should never be undefined given control entries above
  return entry?.systemPrompt ?? ''
}

/**
 * PostHog experiment name for a given agent role.
 * Passed to assignVariant() in the runner.
 */
export function experimentName(role: AgentRole): string {
  return `agent_prompt_${role.toLowerCase()}`
}
