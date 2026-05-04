'use client';

/**
 * Webhook endpoints table with per-row actions.
 * @module dashboard/integrations/webhooks/webhook-list
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { WebhookTestButton } from './webhook-test-button';
import { WebhookAttemptsModal } from './webhook-attempts-modal';
import { WebhookForm } from './webhook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import type { WebhookEndpoint } from '@/lib/webhooks/types';

interface Props {
  endpoints: WebhookEndpoint[];
  onRefresh: () => void;
}

export function WebhookList({ endpoints, onRefresh }: Props) {
  const t = useTranslations('dashboard.integrations.webhooks');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attemptsId, setAttemptsId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function toggleActive(ep: WebhookEndpoint) {
    setActionLoading(ep.id);
    try {
      await fetch(`/api/v1/webhooks/${ep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !ep.active }),
      });
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
      onRefresh();
    } finally {
      setActionLoading(null);
      setConfirmDeleteId(null);
    }
  }

  const editingEndpoint = editingId ? endpoints.find(e => e.id === editingId) : undefined;
  const attemptsEndpoint = attemptsId ? endpoints.find(e => e.id === attemptsId) : undefined;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">{t('col_url')}</th>
              <th className="px-4 py-3">{t('col_events')}</th>
              <th className="px-4 py-3">{t('col_active')}</th>
              <th className="px-4 py-3">{t('col_last_success')}</th>
              <th className="px-4 py-3">{t('col_failures')}</th>
              <th className="px-4 py-3">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map(ep => (
              <tr key={ep.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="truncate font-mono text-xs">{ep.url}</div>
                  {ep.description && (
                    <div className="text-xs text-muted-foreground truncate">{ep.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {ep.events.map(ev => (
                      <Badge key={ev} variant="secondary" className="text-xs px-1.5 py-0">
                        {ev}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${ep.active ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {ep.active ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {ep.lastSuccessAt ? new Date(ep.lastSuccessAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {ep.failureCount > 0
                    ? <span className="text-yellow-500">{ep.failureCount}</span>
                    : <span className="text-muted-foreground">0</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <WebhookTestButton endpointId={ep.id} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={() => setEditingId(ep.id)}
                    >
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={() => toggleActive(ep)}
                      disabled={actionLoading === ep.id}
                    >
                      {ep.active ? t('disable') : t('enable')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={() => setAttemptsId(ep.id)}
                    >
                      {t('view_attempts')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDeleteId(ep.id)}
                    >
                      {t('delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingEndpoint && (
        <Dialog open onOpenChange={() => setEditingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('edit_webhook')}</DialogTitle>
            </DialogHeader>
            <WebhookForm
              endpoint={editingEndpoint}
              onSuccess={() => { setEditingId(null); onRefresh(); }}
              onCancel={() => setEditingId(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Attempts modal */}
      {attemptsEndpoint && (
        <WebhookAttemptsModal
          endpointId={attemptsEndpoint.id}
          endpointUrl={attemptsEndpoint.url}
          onClose={() => setAttemptsId(null)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <Dialog open onOpenChange={() => setConfirmDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('confirm_delete_title')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t('confirm_delete_body')}</p>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={actionLoading === confirmDeleteId}
              >
                {t('delete_confirm')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
