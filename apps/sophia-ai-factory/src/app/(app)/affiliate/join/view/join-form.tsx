'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/stitch';
import { BenefitsSection } from './benefits-section';
import type { PendingInviteProps } from './types';

export function JoinForm({
  invite,
  isAccepting,
  acceptError,
  onAccept,
}: PendingInviteProps) {
  const t = useTranslations('stitch.affiliates.join');

  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl space-y-6">
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

      <BenefitsSection invite={invite} />

      {acceptError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{acceptError}</span>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={isAccepting}
          disabled={isAccepting}
          onClick={onAccept}
          iconRight={<ShieldCheck className="w-4 h-4" />}
        >
          {isAccepting ? t('accepting') : t('acceptButton')}
        </Button>
      </div>
    </div>
  );
}
