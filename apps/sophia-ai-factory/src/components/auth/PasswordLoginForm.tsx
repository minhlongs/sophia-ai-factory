'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';

interface PasswordLoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  redirectTo: string;
}

export default function PasswordLoginForm({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  error,
  setError,
  onSubmit,
  redirectTo,
}: PasswordLoginFormProps) {
  const t = useTranslations('auth.login');

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try {
        const { error: authError } = await authClient.signIn.email({
          email,
          password,
          callbackURL: redirectTo,
        });

        if (authError) {
          setError(authError.message ?? t('error_login_failed'));
          return;
        }

        // Success - redirect is handled by the parent via onSuccess callback
        onSubmit(e);
      } catch {
        setError(t('error_connection'));
      }
    }} className="space-y-4">
      {error && (
        <div role="alert" aria-live="polite" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          {t('email_label')}
        </label>
        <div className="relative">
          <Mail aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
            className="pl-10"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          {t('password_label')}
        </label>
        <div className="relative">
          <Lock aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-10"
            disabled={loading}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin mr-2" />
            {t('logging_in')}
          </>
        ) : (
          t('sign_in')
        )}
      </Button>
    </form>
  );
}
