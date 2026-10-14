import type { User } from '@/seed/db/client';
import type { WhiteLabelBrandingSettings } from '@/seed/types/custom-domains';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';

export interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export type InitialBrandingData = Partial<WhiteLabelBrandingSettings>;

export interface WhiteLabelLoaderResult {
  isMasterOrEnterprise: boolean;
  effectiveOrgId: string;
  initialDomains: CustomDomainRecord[];
  initialBranding: InitialBrandingData | null;
}
