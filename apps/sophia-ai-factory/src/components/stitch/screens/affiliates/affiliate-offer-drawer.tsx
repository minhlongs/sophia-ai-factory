'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Layers,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  ShieldCheck,
  Share2,
  Loader2,
} from 'lucide-react';
import { Button, Badge } from '@/components/stitch';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import { adoptAffiliateOfferAction } from '@/forest/actions/affiliate-actions';

export interface AffiliateOfferDrawerProps {
  isOpen: boolean;
  offer: AffiliateOffer | null;
  onClose: () => void;
  onAdoptSuccess?: (result: { target: string; campaignId: string; deepLink: string }) => void;
}

function buildTrackingUrl(destinationUrl: string | undefined, offerId: string, subId: string): string {
  const sanitized = subId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!destinationUrl) {
    const query = sanitized ? `?sub_id=${encodeURIComponent(sanitized)}` : '';
    return `https://sophia.agencyos.network/r/${offerId}${query}`;
  }
  const sep = destinationUrl.includes('?') ? '&' : '?';
  const query = sanitized ? `&sub_id=${encodeURIComponent(sanitized)}` : '';
  return `${destinationUrl}${sep}via=sophia${query}`;
}

interface DrawerFeedbackAlertProps {
  feedback: {
    type: 'success' | 'error';
    message: string;
    deepLink?: string;
  };
}

function DrawerFeedbackAlert({ feedback }: DrawerFeedbackAlertProps) {
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

export function AffiliateOfferDrawer({
  isOpen,
  offer,
  onClose,
  onAdoptSuccess,
}: AffiliateOfferDrawerProps) {
  const t = useTranslations('stitch.affiliates.drawer');
  const [subId, setSubId] = useState('');
  const [copied, setCopied] = useState(false);
  const [adoptingTarget, setAdoptingTarget] = useState<'creator_studio' | 'distribution_queue' | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    deepLink?: string;
  } | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap & Escape key listener
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
    // Focus the close button on mount for accessibility
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !offer) {
    return null;
  }

  // Generate live tracking link with subId
  const generatedTrackingUrl = buildTrackingUrl(offer.destinationUrl, offer.id, subId);

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

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-drawer-title"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-xl bg-card/95 dark:bg-[#12141F]/95 backdrop-blur-2xl border-l border-border dark:border-white/[0.1] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto font-sans"
        >
          {/* Header */}
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

            {/* Offer Title & Summary */}
            <div className="mt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {t('title')}
              </span>
              <h3
                id="offer-drawer-title"
                className="text-xl font-bold text-foreground dark:text-white mt-1"
              >
                {offer.programName}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {offer.commissionTerms}
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Percent className="w-3.5 h-3.5 text-primary" />
                  <span>Commission</span>
                </div>
                <div className="text-base font-bold text-foreground dark:text-white mt-1">
                  {offer.commissionRatePct}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>EPC</span>
                </div>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  ${offer.epc.toFixed(2)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Conv. Rate</span>
                </div>
                <div className="text-base font-bold text-indigo-400 mt-1">
                  {offer.conversionRatePct}%
                </div>
              </div>
            </div>

            {/* Commission & Attribution Terms */}
            <div className="mt-6 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('commissionTerms')}
              </h4>

              <div className="flex items-center justify-between text-sm py-1 border-b border-border dark:border-white/[0.04]">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  {t('cookieWindow')}
                </span>
                <span className="font-semibold text-foreground dark:text-white">
                  {t('days', { days: offer.cookieWindowDays })}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm py-1 border-b border-border dark:border-white/[0.04]">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-primary" />
                  {t('minPayout')}
                </span>
                <span className="font-semibold text-foreground dark:text-white">
                  ${offer.minPayoutUsd.toFixed(2)} USD
                </span>
              </div>

              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-primary" />
                  {t('destinationUrl')}
                </span>
                <a
                  href={offer.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline max-w-[220px] truncate inline-flex items-center gap-1"
                >
                  <span className="truncate">{offer.destinationUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>

            {/* Live Affiliate Tracking Link Generator */}
            <div className="mt-6 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground dark:text-white">
                  {t('linkGenerator')}
                </h4>
              </div>

              <label
                htmlFor="subid-input"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                {t('subIdLabel')}
              </label>
              <input
                id="subid-input"
                type="text"
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                placeholder={t('subIdPlaceholder')}
                className="w-full h-10 px-3.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-sm text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all font-mono"
              />

              <div className="mt-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {t('generatedUrl')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedTrackingUrl}
                    className="flex-1 h-10 px-3.5 rounded-lg bg-black/[0.02] dark:bg-black/40 border border-border dark:border-white/[0.08] text-xs text-muted-foreground select-all font-mono truncate"
                  />
                  <Button
                    variant={copied ? 'secondary' : 'outline'}
                    size="md"
                    onClick={handleCopyLink}
                    iconLeft={
                      copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )
                    }
                  >
                    {copied ? t('copied') : t('copyLink')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Feedback Alerts */}
            {feedback && <DrawerFeedbackAlert feedback={feedback} />}
          </div>

          {/* Action Footer: 1-Click Campaign Adoption */}
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
