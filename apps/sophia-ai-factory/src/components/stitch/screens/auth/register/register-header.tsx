'use client';

/**
 * Register Header & Error Banner
 *
 * Layer: components/stitch/screens/auth/register
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

interface RegisterHeaderProps {
  error: string | null;
}

export function RegisterHeader({ error }: RegisterHeaderProps) {
  const t = useTranslations('stitch.auth.register');

  return (
    <>
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-12 h-12 mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/25">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-1 font-display">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">
          {t('subtitle')}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-300 flex items-center gap-2.5"
        >
          <span className="text-rose-400 font-bold">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}
