/**
 * Type definitions for DealDetailDrawer
 *
 * Layer: forest/deals/detail-drawer
 */

import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  DealStage,
} from '@/seed/types/enterprise-deal';

export interface DealDetailDrawerProps {
  deal: EnterpriseDeal | null;
  enrichment: EnterpriseLeadEnrichment | null;
  isOpen: boolean;
  onClose: () => void;
  onStageChange: (stage: DealStage) => Promise<void>;
  onEnrich: () => Promise<void>;
  onOpenMeetingPrep: () => void;
  onOpenProposal: () => void;
  onOpenSandbox: () => void;
  isEnriching?: boolean;
}
