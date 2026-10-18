'use client';

// i18n-namespace: stitch.checkout

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

interface CheckoutHeaderProps {
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  t: ReturnType<typeof useTranslations>;
}

export function CheckoutHeader({ errorMessage, setErrorMessage, t }: CheckoutHeaderProps) {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Billing Gateways</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-2">
            {t('payment.title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            {t('payment.subtitle')}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline hover:text-white ml-4"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
