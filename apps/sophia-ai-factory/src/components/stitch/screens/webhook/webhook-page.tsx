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
  {
    id: '1',
    name: 'Payment Events',
    url: 'https://your-app.com/api/webhooks/payments',
    events: ['payment.succeeded', 'payment.failed'],
    secret: 'whsec_xxx',
    active: true,
  },
  {
    id: '2',
    name: 'Subscription Updates',
    url: 'https://your-app.com/api/webhooks/subscriptions',
    events: ['subscription.created', 'subscription.updated', 'subscription.canceled'],
    secret: 'whsec_yyy',
    active: true,
  },
];

const AVAILABLE_EVENTS = [
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'customer.created',
  'customer.updated',
];

export default function WebhookConfigPage() {
  const [webhooks, _setWebhooks] = useState<WebhookEndpointItem[]>(INITIAL_WEBHOOKS);
  const [showForm, setShowForm] = useState(false);

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
          <Button iconLeft={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
            Add Webhook
          </Button>
        </div>

        {showForm && (
          <NewWebhookFormCard
            availableEvents={AVAILABLE_EVENTS}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="space-y-md">
          {webhooks.map((webhook) => (
            <WebhookItemCard key={webhook.id} webhook={webhook} />
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
{`npx sophia-cli webhook:send \\
  --event payment.succeeded \\
  --url https://your-app.com/api/webhooks/payments \\
  --secret whsec_your_secret`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
