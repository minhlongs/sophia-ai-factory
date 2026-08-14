'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Mail, Loader2 } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';

interface MagicLinkFormProps {
  email: string;
  setEmail: (email: string) => void;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  onSuccess: () => void;
}

export default function MagicLinkForm({
  email,
  setEmail,
  loading,
  error,
  setError,
  onSuccess,
}: MagicLinkFormProps) {
  const t = useTranslations('auth.login');

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try {
        const { error: authError } = await authClient.signIn.magicLink({
          email,
          callbackURL: '/dashboard',
        });

        if (authError) {
          setError(authError.message ?? t('error_magic_failed'));
          return;
        }

        onSuccess();
      } catch {
        setError(t('error_connection'));
      }
    }} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('magic_link_description')}
      </p>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="email-magic" className="text-sm font-medium text-foreground">
          {t('email_label')}
        </label>
        <div className="relative">
          <Mail aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="email-magic"
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

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin mr-2" />
            {t('sending_magic')}
          </>
        ) : (
          t('send_magic_link')
        )}
      </Button>
    </form>
  );
}
