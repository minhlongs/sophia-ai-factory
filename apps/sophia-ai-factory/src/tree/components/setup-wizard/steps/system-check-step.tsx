import React from 'react';
import { AlertCircle, Cloud, Check, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ByokDoctrineBanner } from '@/tree/components/setup-wizard/byok-doctrine-banner';

interface SystemCheckStepProps {
  onNext: () => void;
}

export function SystemCheckStep({ onNext }: SystemCheckStepProps) {
  const t = useTranslations('setup_wizard.system_check');
  const actions = useTranslations('setupWizard.actions');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <ByokDoctrineBanner />
      <h2 className="text-xl font-bold text-foreground tracking-tight">{t('title')}</h2>
      <div className="grid gap-3">
        <div className="flex items-center justify-between p-4 bg-[#F8F9FC] dark:bg-[#090A10]/60 rounded-xl border border-border dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('cloudflare_workers')}</p>
              <p className="text-xs text-muted-foreground">{t('cloudflare_desc')}</p>
            </div>
          </div>
          <span className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Check className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-center justify-between p-4 bg-[#F8F9FC] dark:bg-[#090A10]/60 rounded-xl border border-border dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('security')}</p>
              <p className="text-xs text-muted-foreground">{t('security_desc')}</p>
            </div>
          </div>
          <span className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Check className="w-4 h-4" />
          </span>
        </div>
      </div>
      <div className="bg-[#D97706]/10 dark:bg-[#F59E0B]/10 border border-[#D97706]/25 dark:border-[#F59E0B]/25 p-4 rounded-xl text-xs sm:text-sm text-[#D97706] dark:text-[#F59E0B] flex gap-2.5 items-start">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>{t('next_step')}</p>
      </div>

      <div className="flex justify-end pt-2 border-t border-border dark:border-white/[0.08]">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-lg bg-[#4338CA] dark:bg-[#6366F1] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity shadow-xs"
        >
          {actions('next')}
        </button>
      </div>
    </div>
  );
}
