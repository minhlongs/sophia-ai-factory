/**
 * New Enterprise Deal Modal Types & Form State
 *
 * Layer: forest/deals/new-deal
 */

import type {
  CreateEnterpriseDealInput,
  DealSource,
} from '@/seed/types/enterprise-deal';

export interface NewDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEnterpriseDealInput) => Promise<void>;
  isLoading?: boolean;
}

export interface NewDealFormState {
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadTitle: string;
  companyName: string;
  companyDomain: string;
  leadSource: DealSource;
  dealValueDollars: string;
  requestedMcuMonthly: string;
  timeframe: string;
  needsHighVolumeSyndication: boolean;
  needsApacDubbing: boolean;
  needsDedicatedGpuLane: boolean;
  needsCustomApiOrWhiteLabel: boolean;
  notes: string;
}

export const INITIAL_NEW_DEAL_FORM_STATE: NewDealFormState = {
  leadName: '',
  leadEmail: '',
  leadPhone: '',
  leadTitle: 'VP of Marketing & Production',
  companyName: '',
  companyDomain: '',
  leadSource: 'website',
  dealValueDollars: '54000',
  requestedMcuMonthly: '100000',
  timeframe: 'immediate',
  needsHighVolumeSyndication: true,
  needsApacDubbing: true,
  needsDedicatedGpuLane: true,
  needsCustomApiOrWhiteLabel: false,
  notes: 'Seeking automated video dubbing across 5 APAC languages and high-volume TikTok/Shorts syndication.',
};
