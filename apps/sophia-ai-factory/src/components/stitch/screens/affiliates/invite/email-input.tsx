'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { User, Mail } from 'lucide-react';

interface EmailInputProps {
  partnerName: string;
  onPartnerNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  disabled: boolean;
  initialInputRef: React.RefObject<HTMLInputElement | null>;
}

export function EmailInput({
  partnerName,
  onPartnerNameChange,
  email,
  onEmailChange,
  disabled,
  initialInputRef,
}: EmailInputProps) {
  const t = useTranslations('stitch.affiliates.inviteModal');

  return (
    <>
      {/* Partner Name Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="invite-partner-name"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
        >
          <User className="w-3.5 h-3.5 text-primary" />
          <span>{t('partnerName')} *</span>
        </label>
        <input
          ref={initialInputRef}
          id="invite-partner-name"
          name="partnerName"
          type="text"
          required
          disabled={disabled}
          placeholder={t('partnerNamePlaceholder')}
          value={partnerName}
          onChange={(e) => onPartnerNameChange(e.target.value)}
          className="w-full h-10 px-3.5 rounded-xl bg-black/20 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 text-sm transition-all"
        />
      </div>

      {/* Partner Email Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="invite-partner-email"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5 text-primary" />
          <span>{t('partnerEmail')} *</span>
        </label>
        <input
          id="invite-partner-email"
          name="email"
          type="email"
          required
          disabled={disabled}
          placeholder={t('partnerEmailPlaceholder')}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="w-full h-10 px-3.5 rounded-xl bg-black/20 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 text-sm transition-all"
        />
      </div>
    </>
  );
}
