'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  inviteAffiliateAction,
  type InviteAffiliateResult,
} from '@/forest/actions/affiliate-actions';

interface UseInviteAffiliateParams {
  isOpen: boolean;
  onInviteSuccess?: (result: InviteAffiliateResult) => void;
}

export function useInviteAffiliate({
  isOpen,
  onInviteSuccess,
}: UseInviteAffiliateParams) {
  const t = useTranslations('stitch.affiliates.inviteModal');

  // Form State
  const [partnerName, setPartnerName] = useState('');
  const [email, setEmail] = useState('');
  const [customRate, setCustomRate] = useState<number>(20);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [selectedAssetKits, setSelectedAssetKits] = useState<string[]>([
    'brand_kit',
    'video_scripts',
  ]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<InviteAffiliateResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const initialInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPartnerName('');
      setEmail('');
      setCustomRate(20);
      setWelcomeMessage('');
      setSelectedAssetKits(['brand_kit', 'video_scripts']);
      setErrorMessage(null);
      setSuccessResult(null);
      setCopiedLink(false);

      const timer = setTimeout(() => {
        initialInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const toggleAssetKit = (kitId: string) => {
    setSelectedAssetKits((prev) =>
      prev.includes(kitId) ? prev.filter((id) => id !== kitId) : [...prev, kitId],
    );
  };

  const handleCopyLink = async () => {
    if (!successResult?.inviteLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(successResult.inviteLink);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!partnerName.trim() || partnerName.trim().length < 2) {
      setErrorMessage(t('nameRequired'));
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim() || !emailPattern.test(email.trim())) {
      setErrorMessage(t('emailInvalid'));
      return;
    }

    if (isNaN(customRate) || customRate < 5 || customRate > 80) {
      setErrorMessage(t('rateInvalid'));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await inviteAffiliateAction({
        partnerName: partnerName.trim(),
        email: email.trim().toLowerCase(),
        customRateOverridePct: Number(customRate),
        welcomeMessage: welcomeMessage.trim() || undefined,
        assetKitSelected: selectedAssetKits,
      });

      if (result.success) {
        setSuccessResult(result);
        if (onInviteSuccess) {
          onInviteSuccess(result);
        }
      } else {
        setErrorMessage(result.error || t('error'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    partnerName,
    setPartnerName,
    email,
    setEmail,
    customRate,
    setCustomRate,
    welcomeMessage,
    setWelcomeMessage,
    selectedAssetKits,
    toggleAssetKit,
    isSubmitting,
    errorMessage,
    successResult,
    copiedLink,
    initialInputRef,
    handleCopyLink,
    handleSubmit,
  };
}
