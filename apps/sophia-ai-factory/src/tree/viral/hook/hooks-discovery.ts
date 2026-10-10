/**
 * @file hooks-discovery.ts
 * @layer tree/viral/hook
 * @description Hook generation and trending discovery algorithms.
 */

import type {
  ViralNiche,
  HookArchetype,
  ViralHook,
  TrendingHook,
} from '@/seed/types/growth';
import {
  DETERMINISTIC_HOOK_VAULT,
  ARCHETYPE_DEFINITIONS,
} from '../hook-prompts';
import type { GenerateHooksOptions, FindTrendingHooksOptions } from './types';

export async function generateViralHooks(options: GenerateHooksOptions): Promise<ViralHook[]> {
  const { niche, archetype, customTopic, count = 5 } = options;

  let matches = DETERMINISTIC_HOOK_VAULT.filter((h) => h.niche === niche);

  if (archetype) {
    matches = matches.filter((h) => h.archetype === archetype);
  }

  if (customTopic && customTopic.trim().length > 0) {
    const topic = customTopic.trim();
    const archetypesToUse: HookArchetype[] = archetype
      ? [archetype]
      : ['curiosity_gap', 'shock_stat', 'direct_question', 'problem_solution', 'contrarian'];

    const dynamicHooks: ViralHook[] = archetypesToUse.map((arch, idx) => {
      const archDef = ARCHETYPE_DEFINITIONS[arch];
      let hookText = '';
      let hookTextVi = '';

      switch (arch) {
        case 'curiosity_gap':
          hookText = `The untold truth about ${topic} that top 1% operators refuse to share...`;
          hookTextVi = `Sự thật ít người biết về ${topic} mà nhóm top 1% luôn giấu kín...`;
          break;
        case 'shock_stat':
          hookText = `91% of businesses tackling ${topic} are burning capital without realizing this...`;
          hookTextVi = `91% doanh nghiệp triển khai ${topic} đang lãng phí ngân sách vì bỏ qua điều này...`;
          break;
        case 'direct_question':
          hookText = `Are you still struggling with ${topic} while others are automating it completely?`;
          hookTextVi = `Bạn vẫn đang vật lộn với ${topic} trong khi người khác đã tự động hóa 100%?`;
          break;
        case 'problem_solution':
          hookText = `${topic} used to be a massive headache. Here is how one simple AI agent solved it.`;
          hookTextVi = `${topic} từng là cơn ác mộng đau đầu. Đây là cách đúng 1 AI agent xử lý triệt để.`;
          break;
        case 'contrarian':
          hookText = `Everything you have been told about ${topic} is wrong. Do this instead.`;
          hookTextVi = `Mọi thứ người ta dạy bạn về ${topic} đều đã lỗi thời. Hãy làm theo cách này.`;
          break;
      }

      return {
        id: `dyn_hook_${niche}_${arch}_${idx}_${Date.now()}`,
        niche,
        archetype: arch,
        hookText,
        hookTextVi,
        estimatedSeconds: archDef.idealDurationSec,
        expectedRetentionScore: Math.min(99, 88 + (idx % 10)),
        psychologicalTrigger: `${archDef.name}: Tailored around topic "${topic}".`,
        tags: [niche, arch, 'custom-topic'],
      };
    });

    return dynamicHooks.slice(0, count);
  }

  const pool = matches.length > 0 ? matches : DETERMINISTIC_HOOK_VAULT.filter((h) => h.niche === niche);
  return pool.slice(0, count);
}

export function findTrendingHooks(options: FindTrendingHooksOptions = {}): TrendingHook[] {
  const { niche, minVelocity = 70, limit = 10 } = options;

  let candidates = DETERMINISTIC_HOOK_VAULT;
  if (niche) {
    candidates = candidates.filter((h) => h.niche === niche);
  }

  const brollPool: Record<ViralNiche, string[]> = {
    ai_automation: [
      'High-speed coding terminal screen with green glowing autonomous logs',
      'Split screen comparing slow human worker with fast automated AI agent',
      'Founder drinking coffee while dashboard charts trend sharply up',
    ],
    ecommerce: [
      'Dramatic product unboxing under neon cinematic studio lighting',
      'Customer phone screen showing instant 1-click TikTok Shop checkout',
      'Side-by-side comparison of competitor broken product vs our premium model',
    ],
    solopreneur: [
      'Laptop on beach / balcony showing $5,000 MRR stripe notification',
      'Person closing laptop with relief at 2 PM with zero remaining tasks',
      'Visual timeline showing 1-year transformation from burnout to freedom',
    ],
  };

  const trendingList: TrendingHook[] = candidates.map((hook, index) => {
    const brolls = brollPool[hook.niche];
    const suggestedBroll = brolls[index % brolls.length];
    const viralVelocityScore = Math.min(99, 85 + ((index * 7) % 15));
    const historicalCtrPct = Number((3.8 + ((index * 1.3) % 4.5)).toFixed(1));

    return {
      id: `trend_${hook.id}`,
      hook,
      viralVelocityScore,
      trendCategory: hook.tags[0] || 'trending',
      suggestedBroll,
      historicalCtrPct,
      nicheRelevance: 95,
    };
  });

  return trendingList
    .filter((t) => t.viralVelocityScore >= minVelocity)
    .sort((a, b) => b.viralVelocityScore - a.viralVelocityScore)
    .slice(0, limit);
}
