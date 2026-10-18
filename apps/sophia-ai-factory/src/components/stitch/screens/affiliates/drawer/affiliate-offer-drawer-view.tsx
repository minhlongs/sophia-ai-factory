'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { X, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/stitch';
import type { AffiliateOfferDrawerProps } from './types';
import { OfferDetails } from './offer-details';
import { PayoutTerms } from './payout-terms';
import { useAffiliateDrawer } from './use-affiliate-drawer';
import { DrawerFeedbackAlert } from './drawer-feedback-alert';
import { DrawerFooterActions, type DrawerFooterActionsProps } from './drawer-footer-actions';

export { DrawerFooterActions, type DrawerFooterActionsProps };

export function AffiliateOfferDrawerView({
  isOpen,
  offer,
  onClose,
  onAdoptSuccess,
}: AffiliateOfferDrawerProps) {
  const t = useTranslations('stitch.affiliates.drawer');
  const {
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
  } = useAffiliateDrawer({
    isOpen,
    offer,
    onClose,
    onAdoptSuccess,
  });

  if (!isOpen || !offer) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-drawer-title"
    >
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-xl bg-card/95 dark:bg-[#12141F]/95 backdrop-blur-2xl border-l border-border dark:border-white/[0.1] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto font-sans"
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Badge variant="outline" color="primary">
                  {offer.category}
                </Badge>
                <Badge variant="soft" color="secondary">
                  {offer.payoutModel}
                </Badge>
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{Math.round(offer.qualityScore * 10)}% Quality</span>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <OfferDetails offer={offer} />

            <PayoutTerms
              offer={offer}
              subId={subId}
              onSubIdChange={setSubId}
              generatedTrackingUrl={generatedTrackingUrl}
              copied={copied}
              onCopyLink={handleCopyLink}
            />

            {feedback && <DrawerFeedbackAlert feedback={feedback} />}
          </div>

          <DrawerFooterActions
            adoptingTarget={adoptingTarget}
            onAdopt={handleAdopt}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
