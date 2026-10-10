/**
 * Payouts Client Types and Formatters
 *
 * Layer: forest/components/dashboard/payouts
 */

export interface QueueItem {
  user_id: string;
  balance_available: number;
  balance_pending: number;
  currency: string;
  last_rebuilt_at: number | null;
}

export interface ApiResult {
  items: QueueItem[];
  next_cursor: string | null;
  min_payout_usd: number;
}

export type PayoutMethod = 'usdt_trc20' | 'usdt_erc20' | 'bank_transfer' | 'other';

export const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'usdt_trc20', label: 'USDT TRC20 (Tron)' },
  { value: 'usdt_erc20', label: 'USDT ERC20 (Ethereum)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export function fmtCurrency(n: number, c: string): string {
  const sym = c === 'USD' ? '$' : c === 'VND' ? '₫' : c;
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtTime(ts: number | null): string {
  if (!ts) return 'Never';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });
}
