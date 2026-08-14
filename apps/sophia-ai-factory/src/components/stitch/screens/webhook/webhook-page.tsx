'use client';

import React, { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Badge } from '@/components/stitch';;
export default function WebhookConfigPage() {
  const [webhooks, setWebhooks] = useState([ // eslint-disable-line @typescript-eslint/no-unused-vars
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
  ]);

  const [showForm, setShowForm] = useState(false);

  const availableEvents = [
    'payment.succeeded',
    'payment.failed',
    'payment.refunded',
    'subscription.created',
    'subscription.updated',
    'subscription.canceled',
    'customer.created',
    'customer.updated',
  ];

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
          <Card className="mb-xl" padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">New Webhook</h3>
            </CardHeader>
            <CardContent className="space-y-lg">
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface">Webhook Name</label>
                <Input placeholder="e.g., Payment Events" />
              </div>
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface">Endpoint URL</label>
                <Input placeholder="https://your-app.com/api/webhooks/events" />
              </div>
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface">Events to Subscribe</label>
                <div className="flex flex-wrap gap-sm">
                  {availableEvents.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-sm px-sm py-1 bg-surface rounded-full cursor-pointer hover:bg-surface-container"
                    >
                      <input type="checkbox" className="w-4 h-4 text-primary" />
                      <span className="text-sm text-on-surface">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-sm justify-end pt-md border-t border-outline-variant">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button iconLeft={<Save className="w-4 h-4" />}>Save Webhook</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-md">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} padding="lg">
              <CardHeader className="!p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">{webhook.name}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant font-mono mt-xs">
                      {webhook.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-sm">
                    <Badge variant={webhook.active ? 'soft' : 'outline'} color={webhook.active ? 'success' : 'neutral'}>
                      {webhook.active ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="!p-0 mt-lg">
                <div className="bg-surface rounded-xl p-md">
                  <p className="font-label-sm text-label-sm text-on-surface-variant mb-sm">Subscribed Events</p>
                  <div className="flex flex-wrap gap-xs">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-xs py-0.5 bg-primary/10 text-primary text-xs rounded-full font-mono"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-md pt-md border-t border-outline-variant">
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Signing Secret</p>
                  <code className="font-mono text-sm text-on-surface bg-surface p-sm rounded block mt-xs">
                    {webhook.secret}
                  </code>
                </div>
              </CardContent>
            </Card>
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
