'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { DialogFooter } from '@/seed/components/ui/dialog';
import { Button } from '@/components/stitch';
import { Check, Copy } from 'lucide-react';
import type { InviteAffiliateResult } from '@/forest/actions/affiliate-actions';

interface InviteSuccessViewProps {
  email: string;
  successResult: InviteAffiliateResult;
  copiedLink: boolean;
  onCopyLink: () => Promise<void>;
  onClose: () => void;
}

export function InviteSuccessView({
  email,
  successResult,
  copiedLink,
  onCopyLink,
  onClose,
}: InviteSuccessViewProps) {
  const t = useTranslations('stitch.affiliates.inviteModal');

  return (
    <div className="py-6 space-y-5">
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-start gap-3">
        <Check className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-sm">
            {t('success', { email: email.trim() })}
          </p>
          {successResult.emailDispatched ? (
            <p className="text-xs text-muted-foreground mt-1">
              Bilingual email dispatched via Resend.
            </p>
          ) : (
            <p className="text-xs text-amber-400/90 mt-1">
              Direct invite link generated below. You can copy and share it directly.
            </p>
          )}
        </div>
      </div>

      {successResult.inviteLink && (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('copyLink')}
          </label>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/[0.08]">
            <input
              type="text"
              readOnly
              value={successResult.inviteLink}
              className="flex-1 bg-transparent text-xs text-foreground dark:text-white border-none outline-none font-mono select-all px-2"
            />
            <Button
              type="button"
              variant={copiedLink ? 'primary' : 'outline'}
              size="sm"
              onClick={onCopyLink}
              iconLeft={copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedLink ? t('copied') : t('copyLink')}
            </Button>
          </div>
        </div>
      )}

      <DialogFooter className="pt-4">
        <Button type="button" variant="primary" fullWidth onClick={onClose}>
          {t('done')}
        </Button>
      </DialogFooter>
    </div>
  );
}
