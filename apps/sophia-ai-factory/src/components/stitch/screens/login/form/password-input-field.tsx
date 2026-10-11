import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputFieldProps {
  password: string;
  setPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  error: string | null;
}

export function PasswordInputField({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  error,
}: PasswordInputFieldProps) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label htmlFor="password" className="text-[13px] font-medium text-[#A1A1AA]">
          {t('passwordLabel')}
        </label>
        <Link
          href="/reset-password"
          className="text-[13px] font-medium text-primary hover:opacity-80 transition-opacity"
        >
          {t('forgotPassword')}
        </Link>
      </div>
      <div className="relative group">
        <Lock
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-[44px] pl-10 pr-10 rounded-lg border border-zinc-700 bg-[#0F0F11] text-white text-sm placeholder-zinc-600 transition-all focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
          aria-required="true"
          aria-describedby={error ? 'login-error' : undefined}
          aria-invalid={error ? true : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors rounded-sm p-0.5"
          aria-label={showPassword ? t('hidePassword') : t('showPassword')}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="w-[20px] h-[20px]" aria-hidden="true" />
          ) : (
            <Eye className="w-[20px] h-[20px]" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
