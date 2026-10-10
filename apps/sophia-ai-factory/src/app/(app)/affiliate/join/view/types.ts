import type { ValidateAffiliateInviteResult, AcceptAffiliateInviteResult } from '@/forest/actions/affiliate-actions';

export type { ValidateAffiliateInviteResult, AcceptAffiliateInviteResult };

export interface PendingInviteProps {
  invite: NonNullable<ValidateAffiliateInviteResult['invite']>;
  isAccepting: boolean;
  acceptError: string | null;
  onAccept: () => void;
}

export interface ActivatedInviteProps {
  acceptResult: AcceptAffiliateInviteResult;
  copiedLink: boolean;
  onCopyLink: () => void;
}
