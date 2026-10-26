import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';
import type { LoginFormProps } from './types';

export function resolveRedirectTarget(redirectTo?: string): string {
  const isSafeRelative =
    typeof redirectTo === 'string' &&
    redirectTo.startsWith('/') &&
    !redirectTo.startsWith('//') &&
    !redirectTo.startsWith('/\\') &&
    !redirectTo.startsWith('/api/');
  const raw = isSafeRelative ? redirectTo : '/dashboard';
  return raw.replace(/^\/(?:en|vi)(?=\/|$)/, '') || '/dashboard';
}

export function useAuth2027State({ redirectTo }: LoginFormProps) {
  const t = useTranslations('stitch.auth.login');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError(t('emailRequired'));
    if (!password) return setError(t('invalidCredentials'));
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signIn.email({ email: cleanEmail, password });
      if (res.error) {
        setError(t('invalidCredentials'));
        setLoading(false);
      } else {
        router.push(resolveRedirectTarget(redirectTo));
      }
    } catch {
      setError(t('networkError'));
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      const res = await authClient.signIn.passkey();
      if (res?.error) {
        setError(res.error.message || t('invalidCredentials'));
        setPasskeyLoading(false);
      } else {
        router.push(resolveRedirectTarget(redirectTo));
      }
    } catch {
      setError(t('networkError'));
      setPasskeyLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError(t('emailRequired'));
    setOtpSending(true);
    setError(null);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({ email: cleanEmail, type: 'sign-in' });
      if (res.error) setError(res.error.message || t('networkError'));
      else setOtpSent(true);
      setOtpSending(false);
    } catch {
      setError(t('networkError'));
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError(t('emailRequired'));
    if (otpCode.length !== 6) return setError(t('invalidOtp'));
    setOtpVerifying(true);
    setError(null);
    try {
      const res = await authClient.signIn.emailOtp({ email: cleanEmail, otp: otpCode });
      if (res.error) {
        setError(t('invalidOtp'));
        setOtpVerifying(false);
      } else {
        router.push(resolveRedirectTarget(redirectTo));
      }
    } catch {
      setError(t('networkError'));
      setOtpVerifying(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    error,
    passkeyLoading,
    otpSending,
    otpSent,
    otpCode,
    setOtpCode,
    otpVerifying,
    handleSubmit,
    handlePasskey,
    handleSendOtp,
    handleVerifyOtp,
  };
}
