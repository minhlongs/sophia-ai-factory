'use client';

/**
 * Webhook add/edit form — URL + events + description.
 * Shows secret ONCE in a modal on create.
 * @module dashboard/integrations/webhooks/webhook-form
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import type { WebhookEndpoint, WebhookEvent } from '@/land/webhooks/types';

const ALL_EVENTS: WebhookEvent[] = [
  'mission.completed',
  'video.ready',
  'payment.received',
  'error.threshold',
  'affiliate.discovered',
];

interface Props {
  endpoint?: WebhookEndpoint;
  onSuccess: () => void;
  onCancel: () => void;
}

export function WebhookForm({ endpoint, onSuccess, onCancel }: Props) {
  const t = useTranslations('dashboard.integrations.webhooks');
  const isEdit = !!endpoint;

  const [url, setUrl] = useState(endpoint?.url ?? '');
  const [description, setDescription] = useState(endpoint?.description ?? '');
  const [events, setEvents] = useState<Set<WebhookEvent>>(
    new Set(endpoint?.events ?? ['mission.completed'])
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleEvent(e: WebhookEvent) {
    setEvents(prev => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e); else next.add(e);
      return next;
    });
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);

    if (!url.startsWith('https://')) {
      setError(t('error_https'));
      return;
    }
    if (events.size === 0) {
      setError(t('error_events'));
      return;
    }

    setLoading(true);
    try {
      const body = { url, events: Array.from(events), description: description || undefined };
      const res = await fetch(
        isEdit ? `/api/v1/webhooks/${endpoint!.id}` : '/api/v1/webhooks',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json() as { endpoint?: { secret?: string }; error?: string };
      if (!res.ok) {
        setError(data.error ?? t('error_generic'));
        return;
      }
      if (!isEdit && data.endpoint?.secret) {
        setCreatedSecret(data.endpoint.secret);
      } else {
        onSuccess();
      }
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (createdSecret) {
    return (
      <Dialog open onOpenChange={() => { setCreatedSecret(null); onSuccess(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('secret_title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive font-medium">{t('secret_warning')}</p>
          <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
            {createdSecret}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={copySecret} variant="outline">
              {copied ? t('copied') : t('copy_secret')}
            </Button>
            <Button size="sm" onClick={() => { setCreatedSecret(null); onSuccess(); }}>
              {t('done')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t('field_url')}</label>
        <Input
          type="url"
          placeholder="https://your-server.com/webhook"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('field_events')}</label>
        <div className="space-y-2">
          {ALL_EVENTS.map(ev => (
            <label key={ev} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={events.has(ev)}
                onChange={() => toggleEvent(ev)}
                className="rounded border-gray-400"
              />
              <span className="text-sm font-mono">{ev}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t('field_description')}</label>
        <Input
          placeholder={t('field_description_placeholder')}
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={256}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? t('saving') : isEdit ? t('save_changes') : t('add_webhook')}
        </Button>
      </div>
    </form>
  );
}
