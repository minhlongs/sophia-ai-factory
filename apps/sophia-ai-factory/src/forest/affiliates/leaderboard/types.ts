import type { LeaderboardSummary, AffiliateTier } from '@/seed/types/affiliate-expansion-types';

export interface AffiliateLeaderboardViewProps {
  summary: LeaderboardSummary;
  initialLocale?: 'en' | 'vi';
}

export interface TierBadgeInfo {
  bg: string;
  label: string;
  color: string;
}

export function getTierBadge(tier: AffiliateTier, isVi: boolean): TierBadgeInfo {
  switch (tier) {
    case 'PLATINUM':
      return {
        bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
        label: isVi ? 'Bạch Kim (30%)' : 'Platinum (30%)',
        color: '#38bdf8',
      };
    case 'GOLD':
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        label: isVi ? 'Vàng (25%)' : 'Gold (25%)',
        color: '#f59e0b',
      };
    case 'SILVER':
    default:
      return {
        bg: 'bg-slate-400/10 border-slate-400/30 text-slate-300',
        label: isVi ? 'Bạc (20%)' : 'Silver (20%)',
        color: '#94a3b8',
      };
  }
}
