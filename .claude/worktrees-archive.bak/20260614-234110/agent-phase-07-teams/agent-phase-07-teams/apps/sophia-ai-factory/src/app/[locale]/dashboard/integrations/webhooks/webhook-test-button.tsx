'use client';

/**
 * Fires a test webhook delivery and shows success/fail toast.
 * @module dashboard/integrations/webhooks/webhook-test-button
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';

interface Props {
  endpointId: string;
}

export function WebhookTestButton({ endpointId }: Props) {
  const t = useTranslations('dashboard.integrations.webhooks');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleTest() {
    setStatus('loading');
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/webhooks/${endpointId}/test`, { method: 'POST' });
      const data = await res.json() as {
        result?: { success?: boolean; httpStatus?: number; error?: string };
        error?: string;
      };
      if (!res.ok || !data.result?.success) {
        setStatus('error');
        setMessage(data.result?.error ?? data.error ?? t('test_failed'));
      } else {
        setStatus('success');
        setMessage(`HTTP ${data.result.httpStatus ?? 200}`);
      }
    } catch {
      setStatus('error');
      setMessage(t('error_generic'));
    }
    // Auto-reset after 4s
    setTimeout(() => { setStatus('idle'); setMessage(null); }, 4000);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleTest}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? t('testing') : t('test')}
      </Button>
      {status === 'success' && (
        <span className="text-xs text-green-500">{t('test_success')} {message}</span>
      )}
      {status === 'error' && (
        <span className="text-xs text-destructive">{message}</span>
      )}
    </div>
  );
}
