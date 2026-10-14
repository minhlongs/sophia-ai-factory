export interface CreatorProfileView {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  payoutMethod: 'nowpayments' | 'stripe_connect' | 'usdt' | null;
  payoutAddress: string | null;
  totalEarningsCents: number;
  totalPaidCents: number;
  status: 'pending' | 'active' | 'suspended';
  createdAt: number;
}

export type CreatorErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ALREADY_REGISTERED'
  | 'VALIDATION_ERROR'
  | 'INVITE_INVALID'
  | 'DB_ERROR'
  | 'PROFILE_NOT_FOUND'
  | 'MARKETPLACE_TEMPORARILY_UNAVAILABLE';

export interface CreatorError {
  code: CreatorErrorCode;
  message: string;
}
