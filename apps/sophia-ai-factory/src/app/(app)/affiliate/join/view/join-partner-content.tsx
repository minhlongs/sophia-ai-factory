'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  validateAffiliateInviteAction,
  acceptAffiliateInviteAction,
} from '@/forest/actions/affiliate-actions';
import { InvalidTokenView } from './invalid-token-view';
import { ActivatedInviteView } from './activated-invite-view';
import { JoinForm } from './join-form';
import type { ValidateAffiliateInviteResult, AcceptAffiliateInviteResult } from './types';

export function JoinPartnerContent() {
  const t = useTranslations('stitch.affiliates.join');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isValidating, setIsValidating] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidateAffiliateInviteResult | null>(null);

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

  if (!validationResult?.valid || !validationResult.invite) {
    return <InvalidTokenView />;
  }

  if (acceptResult?.success) {
    return (
      <ActivatedInviteView
        acceptResult={acceptResult}
        copiedLink={copiedLink}
        onCopyLink={handleCopyLink}
      />
    );
  }

  return (
    <JoinForm
      invite={validationResult.invite}
      isAccepting={isAccepting}
      acceptError={acceptError}
      onAccept={handleAcceptInvite}
    />
  );
}
