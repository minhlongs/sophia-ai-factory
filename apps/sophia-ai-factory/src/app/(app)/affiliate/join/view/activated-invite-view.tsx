'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CheckCircle2, Copy, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/stitch';
import type { ActivatedInviteProps } from './types';

export function ActivatedInviteView({
  acceptResult,
  copiedLink,
  onCopyLink,
}: ActivatedInviteProps) {
  const t = useTranslations('stitch.affiliates.join');

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
              onClick={onCopyLink}
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
