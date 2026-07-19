"use client";

/**
 * Subscription tab — current tier, limits, change plan, cancel.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface SubscriptionTabProps {
  tier: string;
  tierLabel: string;
  features: string[];
}

export function AccountSubscriptionTab({ tier, tierLabel, features }: SubscriptionTabProps) {
  const t = useTranslations('account');
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function handleCancel() {
    if (busyRef.current) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    busyRef.current = true;
    setCancelling(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/user/cancel-subscription', { method: 'POST' });
      if (!res.ok) {
        setErrorMsg(t('sub_cancel_failed'));
        return;
      }
      setCancelled(true);
    } catch {
      setErrorMsg(t('sub_cancel_failed'));
    } finally {
      setCancelling(false);
      setConfirming(false);
      busyRef.current = false;
    }
  }

  const isLifetime = tier === 'MASTER';

  return (
    <div className="space-y-6 max-w-lg">
      {/* Current plan card */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-5">
        <p className="text-xs font-medium text-muted-foreground-500 dark:text-slate-400 mb-1">{t('sub_current_plan')}</p>
        <h2 className="text-xl font-bold text-muted-foreground-900 dark:text-slate-100 mb-4">{tierLabel}</h2>

        <div className="space-y-2">
          {features.map(feat => (
            <div key={feat} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-hidden="true" />
              <span className="text-sm text-muted-foreground-700 dark:text-slate-300">{feat}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <Link href="/pricing">
            <Button variant="outline" size="sm" className="cursor-pointer">{t('sub_change')}</Button>
          </Link>
          {!isLifetime && !cancelled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="cursor-pointer text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800/40 dark:hover:bg-red-900/10"
            >
              {cancelling ? '…' : confirming ? t('sub_cancel_confirm').slice(0, 20) + '…' : t('sub_cancel')}
            </Button>
          )}
        </div>

        {confirming && !cancelled && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{t('sub_cancel_confirm')}</p>
          </div>
        )}

        {cancelled && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{t('sub_cancelled')}</p>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10 p-3"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-red-700 dark:text-red-300">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
