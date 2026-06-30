'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Button } from '@/seed/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';

/**
 * Change Email Section — allows user to request an email change.
 * Sends a verification link to the new email address.
 *
 * Wave 20 Phase 04 (7B): UI for POST /api/account/change-email.
 *
 * @module forest/components/settings/sections/change-email-section
 */
export function ChangeEmailSection({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations('settings.changeEmail');
  const csrfHeaders = useCsrfToken();
  const [newEmail, setNewEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setStatus('sending');
    setErrorMessage('');

    startTransition(async () => {
      try {
        const res = await fetch('/api/account/change-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...csrfHeaders },
          body: JSON.stringify({ newEmail: newEmail.trim() }),
        });

        const data = await res.json() as { error?: string; sentTo?: string };
        if (!res.ok) {
          setStatus('error');
          setErrorMessage(data.error ?? t('unknownError'));
          return;
        }

        setStatus('sent');
      } catch {
        setStatus('error');
        setErrorMessage(t('networkError'));
      }
    });
  };

  if (status === 'sent') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('checkEmail', { email: newEmail })}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">{t('currentEmail')}</Label>
            <Input
              id="current-email"
              value={currentEmail}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">{t('newEmail')}</Label>
            <Input
              id="new-email"
              type="email"
              placeholder={t('newEmailPlaceholder')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={status === 'sending'}
              required
              maxLength={254}
            />
          </div>
          {status === 'error' && errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          <Button type="submit" disabled={status === 'sending' || !newEmail.trim()}>
            {status === 'sending' ? t('sending') : t('sendVerification')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
