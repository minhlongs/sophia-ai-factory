'use client';

/**
 * Telegram connection call-to-action.
 *
 * Pairing has three distinct states, and only the server can move it to the
 * last one. Opening the bot link is NOT a successful connection — the customer
 * still has to send /start and the webhook has to record the pairing. Rendering
 * "connected" the moment a tab opens would tell a non-technical customer that a
 * protected flow is finished when it is not.
 *
 * @module app/[locale]/welcome/[token]/client/telegram-cta
 */

import { useTranslations } from 'next-intl';
import { MessageCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { TelegramCtaProps } from './types';

export function TelegramCta({
  telegramPairingState,
  onConnectTelegram,
  onCheckPairing,
}: TelegramCtaProps) {
  const t = useTranslations('welcome');

  const isPaired = telegramPairingState === 'linked';
  const isLinking = telegramPairingState === 'linking' || telegramPairingState === 'awaiting_pairing';

  return (
    <div
      className="max-w-2xl mx-auto px-6 pb-8"
      data-testid="telegram-cta"
      data-pairing-state={telegramPairingState}
    >
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

            {isPaired ? (
              <div
                aria-live="polite"
                className="flex items-center gap-2 text-emerald-400 text-sm font-medium"
              >
                <CheckCircle2 aria-hidden="true" size={16} />
                {t('telegram.pairedHint')}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onConnectTelegram}
                  disabled={isLinking}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none"
                >
                  {telegramPairingState === 'linking' ? (
                    <Loader2 aria-hidden="true" size={16} className="animate-spin" />
                  ) : (
                    <MessageCircle aria-hidden="true" size={16} />
                  )}
                  {t('telegram.connectButton')}
                </button>

                {telegramPairingState === 'awaiting_pairing' && (
                  <button
                    onClick={onCheckPairing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-500/30 text-blue-200 text-sm font-semibold hover:bg-blue-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none"
                  >
                    <RefreshCw aria-hidden="true" size={16} />
                    {t('telegram.checkPairingButton')}
                  </button>
                )}
              </div>
            )}

            {telegramPairingState === 'awaiting_pairing' && (
              <p
                aria-live="polite"
                data-testid="telegram-awaiting-hint"
                className="mt-2 text-xs text-muted-foreground"
              >
                {t('telegram.awaitingPairingHint')}
              </p>
            )}
          </div> [rtk:grouped ×4]
        </div>
      </div>
    </div>
  );
}
