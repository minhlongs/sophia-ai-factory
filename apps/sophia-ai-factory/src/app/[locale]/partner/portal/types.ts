import type { PartnerDashboardData } from '@/tree/partners/types';

export type PortalTab = 'overview' | 'whitelabel' | 'payouts' | 'commissions';

export interface PartnerPortalClientProps {
  initialDashboard: PartnerDashboardData | null;
  locale: string;
  isVi: boolean;
  userEmail?: string;
  isAuthenticated: boolean;
}

export interface WhitelabelConfigState {
  brandName: string;
  customDomain: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  supportUrl: string;
}
