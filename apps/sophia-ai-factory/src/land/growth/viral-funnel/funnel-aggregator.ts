import type {
  ViralFunnelOverview,
  ViralVideoFunnelItem,
  ViralNiche,
  HookArchetype,
} from './types';

/**
 * Aggregate items into the complete overview dashboard structure.
 */
export function buildOverviewFromItems(items: ViralVideoFunnelItem[]): ViralFunnelOverview {
  const totalVideos = items.length;
  const totalViews = items.reduce((sum, item) => sum + item.views, 0);
  const totalCtaClicks = items.reduce((sum, item) => sum + item.ctaClicks, 0);
  const totalLeads = items.reduce((sum, item) => sum + item.leadsCount, 0);
  const totalConversions = items.reduce((sum, item) => sum + item.conversionCount, 0);
  const totalRevenueUsd = items.reduce((sum, item) => sum + item.revenueUsd, 0);
  const averageCtrPct =
    totalViews > 0 ? Number(((totalCtaClicks / totalViews) * 100).toFixed(1)) : 0;

  // Find top performing niche and hook
  const nicheScores: Record<ViralNiche, number> = {
    ai_automation: 0,
    ecommerce: 0,
    solopreneur: 0,
  };
  const hookScores: Record<HookArchetype, number> = {
    curiosity_gap: 0,
    shock_stat: 0,
    direct_question: 0,
    problem_solution: 0,
    contrarian: 0,
  };

  items.forEach((item) => {
    nicheScores[item.niche] = (nicheScores[item.niche] || 0) + item.ctaClicks;
    hookScores[item.hookArchetype] = (hookScores[item.hookArchetype] || 0) + item.ctaClicks;
  });

  let topPerformingNiche: ViralNiche = 'ai_automation';
  let maxNicheScore = -1;
  (Object.keys(nicheScores) as ViralNiche[]).forEach((n) => {
    if (nicheScores[n] > maxNicheScore) {
      maxNicheScore = nicheScores[n];
      topPerformingNiche = n;
    }
  });

  let topPerformingHook: HookArchetype = 'curiosity_gap';
  let maxHookScore = -1;
  (Object.keys(hookScores) as HookArchetype[]).forEach((h) => {
    if (hookScores[h] > maxHookScore) {
      maxHookScore = hookScores[h];
      topPerformingHook = h;
    }
  });

  return {
    totalVideos,
    totalViews,
    totalCtaClicks,
    averageCtrPct,
    totalLeads,
    totalConversions,
    totalRevenueUsd,
    topPerformingNiche,
    topPerformingHook,
    items,
  };
}
