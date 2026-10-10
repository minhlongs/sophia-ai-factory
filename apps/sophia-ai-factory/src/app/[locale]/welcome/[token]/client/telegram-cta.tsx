'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { TelegramCtaProps } from './types';

export function TelegramCta({
  telegramLinked,
  telegramLinking,
  onConnectTelegram,
}: TelegramCtaProps) {
  const t = useTranslations('welcome');

  return (
    <div className="max-w-2xl mx-auto px-6 pb-8">
      <div className="rounded-2xl border border-blue-500/30 bg-blue-900/10 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <MessageCircle aria-hidden="true" size={20} className="text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1">
              {t('telegram.title')}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t('telegram.description')}
            </p>
            {telegramLinked ? (
              <div aria-live="polite" className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 aria-hidden="true" size={16} />
                {t('telegram.openedHint')}
              </div>
            ) : (
              <button
                onClick={onConnectTelegram}
                disabled={telegramLinking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none"
              >
                {telegramLinking ? (
                  <Loader2 aria-hidden="true" size={16} className="animate-spin" />
                ) : (
                  <MessageCircle aria-hidden="true" size={16} />
                )}
                {t('telegram.connectButton')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
