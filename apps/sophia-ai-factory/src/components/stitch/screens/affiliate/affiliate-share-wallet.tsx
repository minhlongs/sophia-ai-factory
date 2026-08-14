'use client';

import React, { useState } from 'react';
import { Copy, Check, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { SocialIcon } from './affiliate-icons';
import { SOCIAL_PLATFORMS } from './affiliate-dashboard-types';

export function AffiliateShareWallet({
  referralLink,
  walletAddress,
  walletBalance,
}: {
  referralLink: string;
  walletAddress: string;
  walletBalance: string;
}) {
  const t = useTranslations('stitch.affiliate');
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {/* Social Share Section */}
      <section
        aria-label={t('aria.socialShareSection')}
        className="bg-surface-container border border-border p-6 rounded-2xl"
      >
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('share.title')}
        </h2>

        <div className="relative mb-4">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="w-full bg-surface-container-high border border-border rounded-lg px-4 py-3 text-sm text-foreground pr-10"
            aria-label={t('share.referralLink')}
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors"
            aria-label={t('share.copyLink')}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          {SOCIAL_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110 ${platform.bg}`}
              aria-label={platform.ariaLabel}
            >
              <SocialIcon path={platform.path} />
            </button>
          ))}
        </div>
      </section>

      {/* Wallet Section */}
      <section
        aria-label={t('aria.walletSection')}
        className="bg-surface-container border border-border p-6 rounded-2xl flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t('wallet.balance')}
            </span>
            <Wallet className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-1">{walletBalance}</h3>
          <p className="text-xs text-muted-foreground">
            {t('wallet.address')}: {walletAddress}
          </p>
        </div>

        <div className="mt-6">
          <Button
            variant="primary"
            className="w-full shadow-md shadow-primary/20 mb-3"
            aria-label={t('wallet.withdraw')}
          >
            {t('wallet.withdraw')}
          </Button>
          <p className="text-[12px] text-center text-muted-foreground italic">
            {t('wallet.minimumWithdrawal', { amount: '$50.00' })}
          </p>
        </div>
      </section>
    </>
  );
}
