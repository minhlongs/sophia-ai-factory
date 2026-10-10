'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { adoptAffiliateOfferAction } from '@/forest/actions/affiliate-actions';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import type { DrawerFeedback } from './types';
import { buildTrackingUrl } from './types';

interface UseAffiliateDrawerParams {
  isOpen: boolean;
  offer: AffiliateOffer | null;
  onClose: () => void;
  onAdoptSuccess?: (result: { target: string; campaignId: string; deepLink: string }) => void;
}

export function useAffiliateDrawer({
  isOpen,
  offer,
  onClose,
  onAdoptSuccess,
}: UseAffiliateDrawerParams) {
  const t = useTranslations('stitch.affiliates.drawer');
  const [subId, setSubId] = useState('');
  const [copied, setCopied] = useState(false);
  const [adoptingTarget, setAdoptingTarget] = useState<'creator_studio' | 'distribution_queue' | null>(null);
  const [feedback, setFeedback] = useState<DrawerFeedback | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setSubId('');
      setCopied(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const generatedTrackingUrl = offer
    ? buildTrackingUrl(offer.destinationUrl, offer.id, subId)
    : '';

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(generatedTrackingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Non-fatal clipboard failure
    }
  };

  const handleAdopt = async (target: 'creator_studio' | 'distribution_queue') => {
    if (!offer) return;
    setAdoptingTarget(target);
    setFeedback(null);
    try {
      const res = await adoptAffiliateOfferAction({
        offerId: offer.id,
        target,
        campaignName: offer.programName,
      });

      if (res.success && res.campaignId && res.deepLink) {
        const message =
          target === 'creator_studio'
            ? t('adoptedCreatorSuccess', { campaignId: res.campaignId })
            : t('queuedSuccess', { campaignId: res.campaignId });

        setFeedback({
          type: 'success',
          message,
          deepLink: res.deepLink,
        });

        if (onAdoptSuccess) {
          onAdoptSuccess({
            target,
            campaignId: res.campaignId,
            deepLink: res.deepLink,
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to adopt campaign',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Campaign adoption error',
      });
    } finally {
      setAdoptingTarget(null);
    }
  };

  return {
    subId,
    setSubId,
    copied,
    adoptingTarget,
    feedback,
    drawerRef,
    closeButtonRef,
    generatedTrackingUrl,
    handleCopyLink,
    handleAdopt,
  };
}
