import type { AffiliateOffer } from '@/seed/types/affiliate';

export interface AffiliateOfferDrawerProps {
  isOpen: boolean;
  offer: AffiliateOffer | null;
  onClose: () => void;
  onAdoptSuccess?: (result: { target: string; campaignId: string; deepLink: string }) => void;
}

export interface DrawerFeedback {
  type: 'success' | 'error';
  message: string;
  deepLink?: string;
}

export interface DrawerFeedbackAlertProps {
  feedback: DrawerFeedback;
}

export function buildTrackingUrl(
  destinationUrl: string | undefined,
  offerId: string,
  subId: string,
): string {
  const sanitized = subId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!destinationUrl) {
    const query = sanitized ? `?sub_id=${encodeURIComponent(sanitized)}` : '';
    return `https://sophia.agencyos.network/r/${offerId}${query}`;
  }
  const sep = destinationUrl.includes('?') ? '&' : '?';
  const query = sanitized ? `&sub_id=${encodeURIComponent(sanitized)}` : '';
  return `${destinationUrl}${sep}via=sophia${query}`;
}
