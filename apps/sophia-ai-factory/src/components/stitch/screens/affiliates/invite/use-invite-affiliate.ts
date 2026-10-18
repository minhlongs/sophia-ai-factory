'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { InviteAffiliateResult } from '@/forest/actions/affiliate-actions';
import {
  DEFAULT_INVITE_ASSET_KITS,
  copyTextWithFallback,
  submitInviteAffiliateRequest,
  validateInviteAffiliateFields,
} from './invite-affiliate-helpers';

interface UseInviteAffiliateParams {
  isOpen: boolean;
  onInviteSuccess?: (result: InviteAffiliateResult) => void;
}

export function useInviteAffiliate({
  isOpen,
  onInviteSuccess,
}: UseInviteAffiliateParams) {
  const t = useTranslations('stitch.affiliates.inviteModal');

  const [partnerName, setPartnerName] = useState('');
  const [email, setEmail] = useState('');
  const [customRate, setCustomRate] = useState<number>(20);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [selectedAssetKits, setSelectedAssetKits] = useState<string[]>([
    ...DEFAULT_INVITE_ASSET_KITS,
  ]);

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
      setSelectedAssetKits([...DEFAULT_INVITE_ASSET_KITS]);
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
    await copyTextWithFallback(successResult.inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateInviteAffiliateFields({
      partnerName,
      email,
      customRate,
      labels: {
        nameRequired: t('nameRequired'),
        emailInvalid: t('emailInvalid'),
        rateInvalid: t('rateInvalid'),
      },
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    const outcome = await submitInviteAffiliateRequest({
      partnerName,
      email,
      customRate,
      welcomeMessage,
      selectedAssetKits,
      fallbackErrorLabel: t('error'),
    });
    setIsSubmitting(false);

    if (outcome.ok) {
      setSuccessResult(outcome.result);
      onInviteSuccess?.(outcome.result);
    } else {
      setErrorMessage(outcome.errorMessage);
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
