'use client';

/**
 * Partner Onboarding & Invitation Redemption Page
 *
 * Route: /affiliate/join?token=...
 * Validates invitation token against Cloudflare D1 affiliate_invites table,
 * executes atomic OCC redemption (pending -> accepted), and presents the
 * partner credentials, custom commission rate, and unique referral link.
 *
 * @module app/(app)/affiliate/join/page
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Percent,
  Package,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/stitch';
import {
  validateAffiliateInviteAction,
  acceptAffiliateInviteAction,
  type ValidateAffiliateInviteResult,
  type AcceptAffiliateInviteResult,
} from '@/forest/actions/affiliate-actions';

function JoinPartnerContent() {
  const t = useTranslations('stitch.affiliates.join');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  // Validation State
  const [isValidating, setIsValidating] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidateAffiliateInviteResult | null>(null);

  // Acceptance State
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptResult, setAcceptResult] = useState<AcceptAffiliateInviteResult | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        if (isMounted) {
          setValidationResult({ valid: false, reason: 'NOT_FOUND' });
          setIsValidating(false);
        }
        return;
      }

      setIsValidating(true);
      try {
        const result = await validateAffiliateInviteAction(token);
        if (isMounted) {
          setValidationResult(result);
        }
      } catch {
        if (isMounted) {
          setValidationResult({ valid: false, reason: 'NOT_FOUND' });
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token || isAccepting) return;
    setIsAccepting(true);
    setAcceptError(null);
    try {
      const result = await acceptAffiliateInviteAction({ token });
      if (result.success) {
        setAcceptResult(result);
      } else {
        setAcceptError(result.error || 'Failed to accept invitation');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
      setAcceptError(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!acceptResult?.referralLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(acceptResult.referralLink);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // 1. Loading State
  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {t('validatingToken')}
        </p>
      </div>
    );
  }

  // 2. Invalid or Expired Token View
  if (!validationResult?.valid || !validationResult.invite) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-destructive/30 text-center shadow-2xl space-y-5">
        <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">
            {t('invalidTokenTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('invalidTokenDescription')}
          </p>
        </div>
        <div className="pt-2">
          <Link href="/">
            <Button variant="outline" fullWidth>
              {t('backToHome')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { invite } = validationResult;

  // 3. Activated Success View (After OCC Acceptance)
  if (acceptResult?.success) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-emerald-500/30 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">
            {t('activatedTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('activatedDescription')}
          </p>
        </div>

        {/* Credentials and Referral Box */}
        <div className="p-4 rounded-xl bg-black/30 dark:bg-black/50 border border-white/[0.08] text-left space-y-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              {t('partnerCode')}
            </span>
            <span className="text-lg font-mono font-bold text-primary">
              {acceptResult.partnerCode}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              {t('referralLink')}
            </span>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/[0.06]">
              <input
                type="text"
                readOnly
                value={acceptResult.referralLink}
                className="flex-1 bg-transparent text-xs text-foreground dark:text-white font-mono select-all outline-none"
              />
              <Button
                type="button"
                size="sm"
                variant={copiedLink ? 'primary' : 'outline'}
                onClick={handleCopyLink}
                iconLeft={copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedLink ? t('copied') : t('copyLink')}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <Link href="/affiliates" className="w-full">
            <Button variant="primary" fullWidth iconRight={<ArrowRight className="w-4 h-4" />}>
              {t('goToDashboard')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Valid Pending Invitation Welcome View
  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-1">
          <Sparkles className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">
          {t('welcomePartner', { name: invite.partnerName })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Highlights Card */}
      <div className="p-4 rounded-xl bg-black/20 dark:bg-white/[0.02] border border-border dark:border-white/[0.08] space-y-3">
        <div className="flex items-center gap-3 text-emerald-400">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-semibold">
              {t('exclusiveRate', { rate: invite.customCommissionRatePct })}
            </span>
          </div>
        </div>

        {invite.welcomeMessage && (
          <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04] text-xs text-muted-foreground italic">
            {t('inviterNote', { message: invite.welcomeMessage })}
          </div>
        )}

        {invite.assetKits && invite.assetKits.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              {t('assetKitsIncluded')}
            </span>
            <div className="flex flex-wrap gap-2">
              {invite.assetKits.map((kit) => (
                <span
                  key={kit}
                  className="px-2.5 py-1 rounded-md text-xs bg-primary/10 border border-primary/20 text-primary font-medium"
                >
                  {kit}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error alert if acceptance fails */}
      {acceptError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{acceptError}</span>
        </div>
      )}

      {/* Action CTA Button */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={isAccepting}
          disabled={isAccepting}
          onClick={handleAcceptInvite}
          iconRight={<ShieldCheck className="w-4 h-4" />}
        >
          {isAccepting ? t('accepting') : t('acceptButton')}
        </Button>
      </div>
    </div>
  );
}

export default function JoinAffiliatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <JoinPartnerContent />
    </Suspense>
  );
}
