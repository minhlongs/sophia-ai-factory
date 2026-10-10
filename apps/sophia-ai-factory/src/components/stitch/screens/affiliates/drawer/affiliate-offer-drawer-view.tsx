'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { X, Sparkles, Layers, ShieldCheck, Loader2, Check, ExternalLink } from 'lucide-react';
import { Button, Badge } from '@/components/stitch';
import type { AffiliateOfferDrawerProps, DrawerFeedback } from './types';
import { OfferDetails } from './offer-details';
import { PayoutTerms } from './payout-terms';
import { useAffiliateDrawer } from './use-affiliate-drawer';

function DrawerFeedbackAlert({ feedback }: { feedback: DrawerFeedback }) {
  const isSuccess = feedback.type === 'success';
  return (
    <div
      role="alert"
      className={`mt-4 p-4 rounded-xl text-sm border flex items-start gap-2.5 ${
        isSuccess
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          : 'bg-red-500/10 text-red-300 border-red-500/30'
      }`}
    >
      {isSuccess ? (
        <Check className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
      ) : (
        <X className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
      )}
      <div className="flex-1">
        <div>{feedback.message}</div>
        {feedback.deepLink && (
          <a
            href={feedback.deepLink}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline mt-2"
          >
            <span>Open Campaign View</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

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

          <div className="pt-6 border-t border-border dark:border-white/[0.08] mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={adoptingTarget !== null}
              onClick={() => handleAdopt('creator_studio')}
              iconLeft={
                adoptingTarget === 'creator_studio' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )
              }
            >
              {adoptingTarget === 'creator_studio' ? t('adopting') : t('adoptCreatorStudio')}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={adoptingTarget !== null}
              onClick={() => handleAdopt('distribution_queue')}
              iconLeft={
                adoptingTarget === 'distribution_queue' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )
              }
            >
              {adoptingTarget === 'distribution_queue' ? t('adopting') : t('queueDistribution')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
