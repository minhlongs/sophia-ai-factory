export interface RefundRequest {
  id: string;
  user_id: string;
  purchase_id: string;
  payment_id: string;
  amount_cents: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  created_at: number;
  reviewed_at: number | null;
  reviewed_by_user_id: string | null;
  admin_notes: string | null;
  refund_tx_hash: string | null;
  customer_wallet_address: string | null;
}

export type {
  RefundProcessInput,
  RefundProcessResult,
  RefundError,
} from '../refund-processor';
