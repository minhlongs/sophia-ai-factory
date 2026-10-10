import { Clock, CheckCircle2, XCircle } from 'lucide-react';

export interface WalletMethod {
  id: string;
  method: string;
  display_label: string | null;
  is_default: number;
  verified: number;
  created_at: number;
}

export interface PayoutBatch {
  id: string;
  total_cents: number;
  total_usd: number;
  ledger_count: number;
  status: string;
  payment_method: string;
  network: string | null;
  external_payment_id: string | null;
  created_at: number;
  finalized_at: number | null;
}

export interface PayoutsResponse {
  affiliateId: string;
  batches: PayoutBatch[];
}

export const STATUS_STYLES: Record<string, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  cancelled: 'text-white/40',
};

export const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  processing: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
};
