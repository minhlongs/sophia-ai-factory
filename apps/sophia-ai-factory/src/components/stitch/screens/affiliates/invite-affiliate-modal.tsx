'use client';

import {
  InviteAffiliateModalView,
  type InviteAffiliateModalProps,
} from './invite';

export type { InviteAffiliateModalProps };

export function InviteAffiliateModal(props: InviteAffiliateModalProps) {
  return <InviteAffiliateModalView {...props} />;
}

export default InviteAffiliateModal;
