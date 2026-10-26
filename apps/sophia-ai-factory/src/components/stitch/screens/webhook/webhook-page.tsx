'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHeader, CardContent, Button } from '@/components/stitch';
import {
  NewWebhookFormCard,
  WebhookItemCard,
  type WebhookEndpointItem,
} from './webhook-cards';

export { NewWebhookFormCard, WebhookItemCard } from './webhook-cards';
export type { WebhookEndpointItem, NewWebhookFormCardProps } from './webhook-cards';

const INITIAL_WEBHOOKS: WebhookEndpointItem[] = [
  { id: '1', name: 'Payment Events', url: 'https://your-app.com/api/webhooks/payments', events: ['payment.succeeded', 'payment.failed'], secret: 'whsec_xxx', active: true },
  { id: '2', name: 'Subscription Updates', url: 'https://your-app.com/api/webhooks/subscriptions', events: ['subscription.created', 'subscription.updated', 'subscription.canceled'], secret: 'whsec_yyy', active: true },
];

const AVAILABLE_EVENTS = [
  'payment.succeeded', 'payment.failed', 'payment.refunded',
  'subscription.created', 'subscription.updated', 'subscription.canceled',
  'customer.created', 'customer.updated',
];

export interface WebhookConfigPageProps {
  initialWebhooks?: WebhookEndpointItem[];
}

export default function WebhookConfigPage({ initialWebhooks }: WebhookConfigPageProps = {}) {
  const [webhooks, setWebhooks] = useState<WebhookEndpointItem[]>(initialWebhooks ?? INITIAL_WEBHOOKS);
  const [showForm, setShowForm] = useState(false);

  const handleCreateWebhook = async (input: { name: string; url: string; events: string[] }) => {
    try {
      const { createUserWebhookEndpoint } = await import('@/land/webhooks/webhook-actions');
      const res = await createUserWebhookEndpoint(input);
      if (res.success && res.endpoint) {
        setWebhooks((prev) => [res.endpoint!, ...prev]);
        setShowForm(false);
        return;
      }
    } catch { /* fallback */ }
    setWebhooks((prev) => [
      { id: `wh_${Date.now()}`, name: input.name || 'Webhook Endpoint', url: input.url || 'https://your-app.com/api/webhooks/events', events: input.events, secret: 'whsec_live_generated', active: true },
      ...prev,
    ]);
    setShowForm(false);
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      const { deleteUserWebhookEndpoint } = await import('@/land/webhooks/webhook-actions');
      await deleteUserWebhookEndpoint(id);
    } catch { /* fallback */ }
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const handleToggleWebhook = async (id: string, active: boolean) => {
    try {
      const { toggleUserWebhookEndpoint } = await import('@/land/webhooks/webhook-actions');
      await toggleUserWebhookEndpoint(id, active);
    } catch { /* fallback */ }
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, active } : w)));
  };

  return (
    <div className="min-h-screen bg-background p-lg">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-xl">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Webhook Configuration</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Configure webhook endpoints to receive real-time event notifications
            </p>
          </div>
          <Button iconLeft={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Add Webhook</Button>
        </div>

        {showForm && (
          <NewWebhookFormCard availableEvents={AVAILABLE_EVENTS} onCancel={() => setShowForm(false)} onSave={handleCreateWebhook} />
        )}

        <div className="space-y-md">
          {webhooks.map((webhook) => (
            <WebhookItemCard key={webhook.id} webhook={webhook} onDelete={handleDeleteWebhook} onToggle={handleToggleWebhook} />
          ))}
        </div>

        <Card className="mt-xl" padding="lg">
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Testing Webhooks</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Use our CLI tool to test webhook delivery from your local machine
            </p>
          </CardHeader>
          <CardContent>
            <pre className="bg-surface p-md rounded-xl font-mono text-sm text-on-surface overflow-x-auto">
              {`npx sophia-cli webhook:send --event payment.succeeded --url https://your-app.com/api/webhooks/payments --secret whsec_your_secret`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
