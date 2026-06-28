'use client';

/**
 * Client shell for the webhooks page — manages add form visibility + refresh.
 * @module dashboard/integrations/webhooks/webhooks-page-client
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { WebhookList } from './webhook-list';
import { WebhookForm } from './webhook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import type { WebhookEndpoint } from '@/land/webhooks/types';

interface Props {
  initialEndpoints: WebhookEndpoint[];
}

export function WebhooksPageClient({ initialEndpoints }: Props) {
  const t = useTranslations('dashboard.integrations.webhooks');
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(initialEndpoints);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/v1/webhooks');
      const data = await res.json() as { endpoints?: WebhookEndpoint[] };
      setEndpoints(data.endpoints ?? []);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('endpoint_count', { count: endpoints.length })}
          </span>
          {refreshing && (
            <span className="text-xs text-muted-foreground">{t('refreshing')}</span>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <span className="material-symbols-outlined text-base mr-1.5">add</span>
          {t('add_webhook')}
        </Button>
      </div>

      {endpoints.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-muted-foreground mb-3 block">
            webhook
          </span>
          <p className="text-sm text-muted-foreground">{t('empty_state')}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowAdd(true)}>
            {t('add_first_webhook')}
          </Button>
        </div>
      ) : (
        <WebhookList endpoints={endpoints} onRefresh={refresh} />
      )}

      {/* Add new webhook modal */}
      {showAdd && (
        <Dialog open onOpenChange={() => setShowAdd(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('add_webhook')}</DialogTitle>
            </DialogHeader>
            <WebhookForm
              onSuccess={() => { setShowAdd(false); void refresh(); }}
              onCancel={() => setShowAdd(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
