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
import { RegisterInputField, type RegisterInputFieldProps } from './register-input-field';

export { RegisterInputField, type RegisterInputFieldProps };

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
      <RegisterInputField
        id="company"
        type="text"
        label={t('companyLabel')}
        placeholder={t('companyPlaceholder')}
        value={formState.companyName}
        onChange={(val) => setFormState((p) => ({ ...p, companyName: val }))}
        icon={User}
      />

      <RegisterInputField
        id="email"
        type="email"
        label={t('emailLabel')}
        placeholder={t('emailPlaceholder')}
        value={formState.email}
        onChange={(val) => setFormState((p) => ({ ...p, email: val }))}
        required
        icon={Mail}
      />

      <RegisterInputField
        id="password"
        type="password"
        label={t('passwordLabel')}
        placeholder={t('passwordPlaceholder')}
        value={formState.password}
        onChange={(val) => setFormState((p) => ({ ...p, password: val }))}
        required
        icon={Lock}
      />

      <RegisterInputField
        id="confirmPassword"
        type="password"
        label={t('confirmPasswordLabel')}
        placeholder={t('confirmPasswordPlaceholder')}
        value={formState.confirmPassword}
        onChange={(val) => setFormState((p) => ({ ...p, confirmPassword: val }))}
        required
        icon={Lock}
      />

      {/* Terms Checkbox */}
      <div className="flex items-start pt-1">
        <input
          id="terms"
          type="checkbox"
          checked={formState.agreeTerms}
          onChange={(e) => setFormState((p) => ({ ...p, agreeTerms: e.target.checked }))}
          required
          className="w-4 h-4 mt-0.5 rounded border-[#E2E8F0] dark:border-white/20 bg-[#F8F9FC] dark:bg-[#090A10] text-[#4338CA] dark:text-indigo-600 focus:ring-[#4338CA]/30 dark:focus:ring-indigo-500/30"
        />
        <label htmlFor="terms" className="ml-2.5 text-xs text-slate-600 dark:text-slate-400 leading-normal select-none">
          {t('termsPrefix')}{' '}
          <Link href="/terms" className="text-[#4338CA] dark:text-indigo-400 hover:opacity-80 dark:hover:text-indigo-300 underline">
            {t('termsLink')}
          </Link>
          {' '}{t('and')}{' '}
          <Link href="/privacy" className="text-[#4338CA] dark:text-indigo-400 hover:opacity-80 dark:hover:text-indigo-300 underline">
            {t('privacyLink')}
          </Link>
        </label>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button type="submit" fullWidth loading={loading} className="h-12 text-base font-bold shadow-lg shadow-[#4338CA]/20 dark:shadow-indigo-500/25">
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
