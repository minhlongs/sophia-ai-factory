// i18n-namespace: auth.signup
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';
import { trackSignupComplete } from '@/land/analytics/conversion-events';
import type { SignupFormProps } from './types';
import { CredentialsFields } from './credentials-fields';

export function SignupFormView({ t }: SignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function validate(): string | null {
    if (password.length < 8) return t.error_password_too_short;
    if (password !== confirm) return t.error_password_mismatch;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: '/dashboard/onboarding',
      });

      if (authError) {
        const msg = authError.message?.toLowerCase() ?? '';
        if (msg.includes('already') || msg.includes('exist') || msg.includes('duplicate')) {
          setError(t.error_email_exists);
        } else {
          setError(authError.message ?? t.error_generic);
        }
        return;
      }

      setSuccess(true);
      trackSignupComplete({ method: 'email' });
      router.push('/dashboard/onboarding');
      router.refresh();
    } catch {
      setError(t.error_generic);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" data-testid="signup-success">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-green-400" aria-hidden="true" />
        </div>
        <p className="font-semibold text-foreground">{t.success_title}</p>
        <p className="text-sm text-muted-foreground">{t.success_message}</p>
        <Loader2 className="w-4 h-4 motion-safe:animate-spin text-primary-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="signup-form">
      {error && (
        <div
          id="signup-error"
          role="alert"
          className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <CredentialsFields
        t={t}
        name={name}
        email={email}
        password={password}
        confirm={confirm}
        error={error}
        onNameChange={setName}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirm}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" /> {t.submitting}</>
        ) : (
          t.submit
        )}
      </button>
    </form>
  );
}
