'use client';

/**
 * Invite Affiliate Modal Component
 *
 * Accessible dialog modal based on Radix UI (@/seed/components/ui/dialog)
 * implementing WAI-ARIA role="dialog", aria-modal="true", focus trapping,
 * and Escape key dismissal.
 *
 * Provides partner name, email, custom commission override %,
 * welcome message, and 4 marketing asset kit attachments.
 * Dispatches via inviteAffiliateAction Server Action.
 *
 * @module components/stitch/screens/affiliates/invite-affiliate-modal
 */

import React, { useState, useEffect, useRef } from 'react';
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
import {
  Mail,
  User,
  Percent,
  MessageSquare,
  Package,
  Check,
  Copy,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  inviteAffiliateAction,
  type InviteAffiliateResult,
} from '@/forest/actions/affiliate-actions';

export interface InviteAffiliateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: (result: InviteAffiliateResult) => void;
}

type AssetKitLabelKey = 'kitBrand' | 'kitScripts' | 'kitSwipes' | 'kitBroll';

interface AssetKitOption {
  id: string;
  labelKey: AssetKitLabelKey;
}

const ASSET_KIT_OPTIONS: AssetKitOption[] = [
  { id: 'brand_kit', labelKey: 'kitBrand' },
  { id: 'video_scripts', labelKey: 'kitScripts' },
  { id: 'email_swipes', labelKey: 'kitSwipes' },
  { id: 'demo_broll', labelKey: 'kitBroll' },
];

export function InviteAffiliateModal({
  isOpen,
  onClose,
  onInviteSuccess,
}: InviteAffiliateModalProps) {
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

  // Reset state whenever modal is opened
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

      // Focus first input upon opening
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
      // Fallback for clipboard permission issues
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
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
          // Success State View
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
                    onClick={handleCopyLink}
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
        ) : (
          // Form View
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
                disabled={isSubmitting}
                placeholder={t('partnerNamePlaceholder')}
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
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
                disabled={isSubmitting}
                placeholder={t('partnerEmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl bg-black/20 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 text-sm transition-all"
              />
            </div>

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
                disabled={isSubmitting}
                value={customRate}
                onChange={(e) => setCustomRate(parseFloat(e.target.value) || 0)}
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
                disabled={isSubmitting}
                placeholder={t('welcomeMessagePlaceholder')}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
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
                      disabled={isSubmitting}
                      onClick={() => toggleAssetKit(kit.id)}
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

            {/* Modal Actions */}
            <DialogFooter className="pt-4 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={onClose}
              >
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

export default InviteAffiliateModal;
