'use client';

/**
 * Registration Input Form Component
 *
 * Layer: components/stitch/screens/auth/register
 */

import React from 'react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import { Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/stitch';
import type { RegisterFormState } from './types';

interface RegisterFormProps {
  formState: RegisterFormState;
  setFormState: React.Dispatch<React.SetStateAction<RegisterFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export function RegisterForm({
  formState,
  setFormState,
  onSubmit,
  loading,
}: RegisterFormProps) {
  const t = useTranslations('stitch.auth.register');

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {/* Company Name */}
      <div>
        <label htmlFor="company" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          {t('companyLabel')}
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="company"
            type="text"
            placeholder={t('companyPlaceholder')}
            value={formState.companyName}
            onChange={(e) => setFormState((p) => ({ ...p, companyName: e.target.value }))}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          {t('emailLabel')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            value={formState.email}
            onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
            required
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          {t('passwordLabel')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="password"
            type="password"
            placeholder={t('passwordPlaceholder')}
            value={formState.password}
            onChange={(e) => setFormState((p) => ({ ...p, password: e.target.value }))}
            required
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          {t('confirmPasswordLabel')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="confirmPassword"
            type="password"
            placeholder={t('confirmPasswordPlaceholder')}
            value={formState.confirmPassword}
            onChange={(e) => setFormState((p) => ({ ...p, confirmPassword: e.target.value }))}
            required
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Terms Checkbox */}
      <div className="flex items-start pt-1">
        <input
          id="terms"
          type="checkbox"
          checked={formState.agreeTerms}
          onChange={(e) => setFormState((p) => ({ ...p, agreeTerms: e.target.checked }))}
          required
          className="w-4 h-4 mt-0.5 rounded border-white/20 bg-[#08090D] text-indigo-600 focus:ring-indigo-500/30"
        />
        <label htmlFor="terms" className="ml-2.5 text-xs text-slate-400 leading-normal select-none">
          {t('termsPrefix')}{' '}
          <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 underline">
            {t('termsLink')}
          </Link>
          {' '}{t('and')}{' '}
          <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">
            {t('privacyLink')}
          </Link>
        </label>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button type="submit" fullWidth loading={loading} className="h-12 text-base font-bold shadow-xl shadow-indigo-500/25">
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
