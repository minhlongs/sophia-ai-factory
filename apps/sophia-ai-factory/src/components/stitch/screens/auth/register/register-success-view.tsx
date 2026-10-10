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
    <div className="rounded-2xl border border-white/10 bg-[#12141F]/90 p-8 md:p-10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl text-center space-y-6">
      <div className="inline-flex items-center justify-center">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-2 font-display">
          {t('successTitle')}
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          {t('successMessage')}
        </p>
      </div>
      <div className="pt-2 space-y-3">
        <Link
          href="/setup"
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all"
        >
          <span>{t('startSetup')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 font-semibold text-sm transition-all"
        >
          {t('goToLogin')}
        </Link>
      </div>
    </div>
  );
}
