'use client';

/**
 * Modal showing last 50 delivery attempts for a webhook endpoint.
 * @module dashboard/integrations/webhooks/webhook-attempts-modal
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import type { WebhookAttempt } from '@/lib/webhooks/types';

interface Props {
  endpointId: string;
  endpointUrl: string;
  onClose: () => void;
}

export function WebhookAttemptsModal({ endpointId, endpointUrl, onClose }: Props) {
  const t = useTranslations('dashboard.integrations.webhooks');
  const [attempts, setAttempts] = useState<WebhookAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/webhooks/${endpointId}/attempts`)
      .then(r => r.json())
      .then((d: unknown) => {
        const data = d as { attempts?: WebhookAttempt[]; error?: string };
        if (data.error) { setError(data.error); return; }
        setAttempts(data.attempts ?? []);
      })
      .catch(() => setError(t('error_generic')))
      .finally(() => setLoading(false));
  }, [endpointId, t]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('attempts_title')}</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{endpointUrl}</p>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && attempts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('attempts_empty')}</p>
        )}

        {!loading && attempts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">{t('col_timestamp')}</th>
                  <th className="py-2 pr-3">{t('col_event')}</th>
                  <th className="py-2 pr-3">{t('col_attempt')}</th>
                  <th className="py-2 pr-3">{t('col_status_code')}</th>
                  <th className="py-2 pr-3">{t('col_result')}</th>
                  <th className="py-2">{t('col_error')}</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map(a => (
                  <tr key={a.id} className="border-b hover:bg-muted/30">
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{a.event}</td>
                    <td className="py-1.5 pr-3 text-center">{a.attemptNum}</td>
                    <td className="py-1.5 pr-3 text-center">
                      {a.httpStatus ? (
                        <span className={a.httpStatus < 300 ? 'text-green-500' : 'text-red-400'}>
                          {a.httpStatus}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={
                        a.status === 'success'
                          ? 'text-green-500'
                          : a.status === 'dead_letter'
                          ? 'text-red-400 font-medium'
                          : 'text-yellow-500'
                      }>
                        {a.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-muted-foreground max-w-[200px] truncate">
                      {a.errorMessage ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
