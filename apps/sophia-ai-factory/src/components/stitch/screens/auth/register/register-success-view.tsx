'use client';

/**
 * Register Success Screen Card
 *
 * Layer: components/stitch/screens/auth/register
 */

import React from 'react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, ArrowRight } from 'lucide-react';

export function RegisterSuccessView() {
  const t = useTranslations('stitch.auth.register');

  return (
    <div className="rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] p-8 md:p-10 shadow-xl dark:shadow-2xl text-center space-y-6">
      <div className="inline-flex items-center justify-center">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-sm">
          <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-black text-[#0B0F19] dark:text-white tracking-tight mb-2 font-display">
          {t('successTitle')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {t('successMessage')}
        </p>
      </div>
      <div className="pt-2 space-y-3">
        <Link
          href="/setup"
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#4338CA] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-[#4338CA]/20 dark:shadow-indigo-500/25 transition-all"
        >
          <span>{t('startSetup')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-[#F8F9FC] hover:bg-slate-100 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-[#E2E8F0] dark:border-white/10 text-[#0B0F19] dark:text-slate-200 font-semibold text-sm transition-all"
        >
          {t('goToLogin')}
        </Link>
      </div>
    </div>
  );
}
