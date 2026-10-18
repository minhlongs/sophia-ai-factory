'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/seed/components/ui/dialog';
import { Button } from '@/components/stitch';
import { Mail, AlertCircle, Sparkles } from 'lucide-react';
import type { InviteAffiliateModalProps } from './types';
import { EmailInput } from './email-input';
import { TierAssignment } from './tier-assignment';
import { InviteSuccessView } from './invite-success-view';
import { useInviteAffiliate } from './use-invite-affiliate';

export function InviteAffiliateModalView({
  isOpen,
  onClose,
  onInviteSuccess,
}: InviteAffiliateModalProps) {
  const t = useTranslations('stitch.affiliates.inviteModal');
  const {
    partnerName, setPartnerName, email, setEmail, customRate, setCustomRate,
    welcomeMessage, setWelcomeMessage, selectedAssetKits, toggleAssetKit,
    isSubmitting, errorMessage, successResult, copiedLink,
    initialInputRef, handleCopyLink, handleSubmit,
  } = useInviteAffiliate({ isOpen, onInviteSuccess });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-modal="true"
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-[#12141F]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl text-foreground dark:text-white"
        aria-describedby="invite-modal-desc"
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground dark:text-white">
              {t('title')}
            </DialogTitle>
          </div>
          <DialogDescription id="invite-modal-desc" className="text-sm text-muted-foreground">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          <InviteSuccessView
            email={email}
            successResult={successResult}
            copiedLink={copiedLink}
            onCopyLink={handleCopyLink}
            onClose={onClose}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <EmailInput
              partnerName={partnerName}
              onPartnerNameChange={setPartnerName}
              email={email}
              onEmailChange={setEmail}
              disabled={isSubmitting}
              initialInputRef={initialInputRef}
            />

            <TierAssignment
              customRate={customRate}
              onCustomRateChange={setCustomRate}
              welcomeMessage={welcomeMessage}
              onWelcomeMessageChange={setWelcomeMessage}
              selectedAssetKits={selectedAssetKits}
              onToggleAssetKit={toggleAssetKit}
              disabled={isSubmitting}
            />

            <DialogFooter className="pt-4 flex items-center gap-3">
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                iconLeft={<Mail className="w-4 h-4" />}
              >
                {isSubmitting ? t('submitting') : t('submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
