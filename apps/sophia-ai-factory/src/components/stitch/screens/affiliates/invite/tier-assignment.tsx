'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Percent, MessageSquare, Package, Check } from 'lucide-react';
import { ASSET_KIT_OPTIONS } from './types';

interface TierAssignmentProps {
  customRate: number;
  onCustomRateChange: (value: number) => void;
  welcomeMessage: string;
  onWelcomeMessageChange: (value: string) => void;
  selectedAssetKits: string[];
  onToggleAssetKit: (kitId: string) => void;
  disabled: boolean;
}

export function TierAssignment({
  customRate,
  onCustomRateChange,
  welcomeMessage,
  onWelcomeMessageChange,
  selectedAssetKits,
  onToggleAssetKit,
  disabled,
}: TierAssignmentProps) {
  const t = useTranslations('stitch.affiliates.inviteModal');

  return (
    <>
      {/* Commission Rate Override Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="invite-commission-rate"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
        >
          <Percent className="w-3.5 h-3.5 text-primary" />
          <span>{t('commissionOverride')}</span>
        </label>
        <input
          id="invite-commission-rate"
          name="customRateOverridePct"
          type="number"
          min={5}
          max={80}
          step={1}
          disabled={disabled}
          value={customRate}
          onChange={(e) => onCustomRateChange(parseFloat(e.target.value) || 0)}
          className="w-full h-10 px-3.5 rounded-xl bg-black/20 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 text-sm transition-all font-mono"
        />
        <p className="text-[11px] text-muted-foreground">
          {t('commissionOverrideHelp')}
        </p>
      </div>

      {/* Welcome Message Textarea */}
      <div className="space-y-1.5">
        <label
          htmlFor="invite-welcome-message"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span>{t('welcomeMessage')}</span>
        </label>
        <textarea
          id="invite-welcome-message"
          name="welcomeMessage"
          rows={2}
          disabled={disabled}
          placeholder={t('welcomeMessagePlaceholder')}
          value={welcomeMessage}
          onChange={(e) => onWelcomeMessageChange(e.target.value)}
          className="w-full p-3 rounded-xl bg-black/20 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 text-sm transition-all resize-none"
        />
      </div>

      {/* Marketing Asset Kits Selection */}
      <div className="space-y-2 pt-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          <span>{t('assetKits')}</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ASSET_KIT_OPTIONS.map((kit) => {
            const isChecked = selectedAssetKits.includes(kit.id);
            return (
              <button
                key={kit.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggleAssetKit(kit.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs text-left border transition-all ${
                  isChecked
                    ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                    : 'bg-black/10 dark:bg-white/[0.02] border-border dark:border-white/[0.06] text-muted-foreground hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                    isChecked
                      ? 'bg-primary border-primary text-white'
                      : 'border-white/20 bg-transparent'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="truncate">{t(kit.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
