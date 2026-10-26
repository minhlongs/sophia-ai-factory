'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Mail, KeyRound, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';

export function ResetPasswordFormView() {
  const t = useTranslations('resetPassword');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError(t('email_label'));
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: cleanEmail,
        type: 'forget-password',
      });
      if (res.error) setError(res.error.message || t('error_generic'));
      else setStep('confirm');
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return setError(t('error_token_missing'));
    if (password.length < 8) return setError(t('error_password_too_short'));
    if (password !== confirmPassword) return setError(t('error_password_mismatch'));
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.emailOtp.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password,
      });
      if (res.error) setError(res.error.message || t('error_generic'));
      else setStep('success');
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">{t('confirm_success_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('confirm_success_body')}</p>
        <Link href="/login" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:brightness-110 transition-all">
          <span>{t('sign_in_now')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <div role="alert" className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-medium">{error}</div>}
      {step === 'request' ? (
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="reset-email" className="text-xs font-semibold text-muted-foreground">{t('email_label')}</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email_placeholder')} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-md">
            {loading ? t('submitting') : t('submit_request')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="reset-otp" className="text-xs font-semibold text-muted-foreground">{t('token')}</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="reset-otp" type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="text-xs font-semibold text-muted-foreground">{t('new_password_label')}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('new_password_placeholder')} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="text-xs font-semibold text-muted-foreground">{t('confirm_password_label')}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="reset-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('confirm_password_placeholder')} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-md">
            {loading ? t('setting') : t('submit_confirm')}
          </button>
        </form>
      )}
      <div className="text-center pt-1">
        <Link href="/login" className="text-xs font-semibold text-primary hover:underline">{t('back_to_login')}</Link>
      </div>
    </div>
  );
}
