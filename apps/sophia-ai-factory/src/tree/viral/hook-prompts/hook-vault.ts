/**
 * @file hook-vault.ts
 * @description Deterministic high-converting hook vault for fallback and zero-latency generation.
 * @layer tree
 */

import type { ViralHook } from '@/seed/types/growth';
import { ECOM_AND_SOLO_HOOKS } from './hook-vault-catalog';

export { ECOM_AND_SOLO_HOOKS };

export const AI_AUTOMATION_HOOKS: ViralHook[] = [
  // AI Automation
  {
    id: 'hook_ai_curiosity',
    niche: 'ai_automation',
    archetype: 'curiosity_gap',
    hookText: 'Most marketing agencies are hiding this one AI workflow from their clients...',
    hookTextVi: 'Hầu hết các agency marketing đang giấu khách hàng quy trình tự động hóa AI này...',
    estimatedSeconds: 3,
    expectedRetentionScore: 94,
    psychologicalTrigger: 'Curiosity Gap: Information asymmetry and insider secret framing.',
    tags: ['agency-secret', 'ai-workflow', 'curiosity'],
  },
  {
    id: 'hook_ai_shock_stat',
    niche: 'ai_automation',
    archetype: 'shock_stat',
    hookText: '83% of creative agencies will be replaced by 3-person AI operations by next year.',
    hookTextVi: '83% agency sáng tạo sẽ bị thay thế bởi đội ngũ AI chỉ gồm 3 người vào năm tới.',
    estimatedSeconds: 4,
    expectedRetentionScore: 91,
    psychologicalTrigger: 'Shocking Stat: Existential disruption urgency.',
    tags: ['stat', 'urgency', 'industry-shift'],
  },
  {
    id: 'hook_ai_direct_question',
    niche: 'ai_automation',
    archetype: 'direct_question',
    hookText: 'Are you still paying someone $3,000 a month to edit videos manually?',
    hookTextVi: 'Bạn vẫn đang trả 70 triệu mỗi tháng chỉ để thuê người dựng video thủ công ư?',
    estimatedSeconds: 3,
    expectedRetentionScore: 95,
    psychologicalTrigger: 'Direct Question: Financial waste call-out and acute cognitive dissonance.',
    tags: ['cost-cutting', 'direct-question', 'video-editing'],
  },
  {
    id: 'hook_ai_problem_solution',
    niche: 'ai_automation',
    archetype: 'problem_solution',
    hookText: 'Stop burning 40 hours a week on client reports. Here is how one agency automated everything.',
    hookTextVi: 'Đừng lãng phí 40 tiếng mỗi tuần làm báo cáo khách hàng nữa. Đây là cách agency tự động hóa toàn bộ.',
    estimatedSeconds: 4,
    expectedRetentionScore: 89,
    psychologicalTrigger: 'Problem-Solution: Immediate operational relief.',
    tags: ['client-reports', 'agency-scale', 'automation'],
  },
  {
    id: 'hook_ai_contrarian',
    niche: 'ai_automation',
    archetype: 'contrarian',
    hookText: 'Why hiring more staff is the fastest way to bankrupt your marketing agency in 2026.',
    hookTextVi: 'Tại sao tuyển thêm nhân viên là cách nhanh nhất khiến agency phá sản trong năm 2026.',
    estimatedSeconds: 4,
    expectedRetentionScore: 96,
    psychologicalTrigger: 'Contrarian: Counter-intuitive business threat.',
    tags: ['contrarian', 'agency-risk', 'headcount-trap'],
  },
];

export const DETERMINISTIC_HOOK_VAULT: ViralHook[] = [
  ...AI_AUTOMATION_HOOKS,
  ...ECOM_AND_SOLO_HOOKS,
];
