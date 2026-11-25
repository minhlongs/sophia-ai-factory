'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/seed/auth/better-auth-client';
import {
  isPilotInviteBlockedError,
  resolveRedirectTarget,
} from '@/components/stitch/screens/login/form/use-auth-2027-state';
import type { RegisterFormState, RegisterStep } from './types';
import { mapRegisterAuthError, validateRegisterForm } from './register-validation';

export function useRegister2027State(redirectTo?: string) {
  const t = useTranslations('stitch.auth.register');
  const tLogin = useTranslations('stitch.auth.login');
  const [step, setStep] = useState<RegisterStep>('form');
  const [formState, setFormState] = useState<RegisterFormState>({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validateRegisterForm(formState, t);
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      const name = formState.companyName.trim() || formState.email.split('@')[0].trim() || 'user';
      const callbackPath = redirectTo
        ? resolveRedirectTarget(redirectTo)
        : '/dashboard/onboarding';
      const result = await authClient.signUp.email({
        name,
        email: formState.email.trim(),
        password: formState.password,
        callbackURL: callbackPath,
      });
      if (result.error) {
        setError(
          mapRegisterAuthError(
            result.error as { code?: string; message?: string; status?: number },
            t,
          ),
        );
      } else {
        setStep('success');
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = formState.email.trim();
    if (!cleanEmail) return setError(tLogin('emailRequired'));
    setOtpSending(true);
    setError(null);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({ email: cleanEmail, type: 'sign-in' });
      if (res.error) {
        setError(
          isPilotInviteBlockedError(res.error)
            ? t('errorInviteRequired')
            : res.error.message || t('errorGeneric'),
        );
      } else {
        setOtpSent(true);
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanEmail = formState.email.trim();
    if (!cleanEmail) return setError(tLogin('emailRequired'));
    if (otpCode.length !== 6) return setError(tLogin('invalidOtp'));
    setOtpVerifying(true);
    setError(null);
    try {
      const res = await authClient.signIn.emailOtp({ email: cleanEmail, otp: otpCode });
      if (res.error) {
        setError(
          isPilotInviteBlockedError(res.error) ? t('errorInviteRequired') : tLogin('invalidOtp'),
        );
      } else {
        setStep('success');
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handlePasskey = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      const res = await authClient.signIn.passkey();
      if (res?.error) {
        setError(
          isPilotInviteBlockedError(res.error)
            ? t('errorInviteRequired')
            : res.error.message || t('errorGeneric'),
        );
      } else {
        setStep('success');
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setPasskeyLoading(false);
    }
  };

  return {
    step,
    formState,
    setFormState,
    loading,
    error,
    passkeyLoading,
    otpSending,
    otpSent,
    otpCode,
    setOtpCode,
    otpVerifying,
    handleSubmit,
    handleSendOtp,
    handleVerifyOtp,
    handlePasskey,
  };
}
