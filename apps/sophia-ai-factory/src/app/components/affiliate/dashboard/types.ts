import type { AffiliatePartner, AffiliateStats } from '@/seed/types/affiliate';

export interface PartnerDashboardClientProps {
  partner: AffiliatePartner;
  stats: AffiliateStats;
  locale: string;
}

export type DashboardTab = 'links' | 'assets' | 'payouts';
export type AssetLanguage = 'en' | 'vi';

export interface PayoutMessage {
  type: 'success' | 'error';
  text: string;
}
