import type { CreatorBalanceSummary, PayoutRail } from '@/tree/marketplace/types';

export interface CreatorRoyaltyWidgetProps {
  initialBalance?: CreatorBalanceSummary | null;
  creatorId?: string;
  onWithdrawalRequested?: () => void;
}

export interface PayoutFormData {
  amountUsd: string;
  rail: PayoutRail;
  destinationAddress: string;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}
