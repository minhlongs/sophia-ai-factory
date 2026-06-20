'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Save, ExternalLink, Link2, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Textarea, Badge } from '@/components/stitch';

export default function WebhookConfigPage() {
  const t = useTranslations('stitch.webhook');
  const [webhooks, setWebhooks] = useState([
    {
      id: '1',
      name: t('examples.paymentEvents'),
      url: 'https://your-app.com/api/webhooks/payments',
      events: ['payment.succeeded', 'payment.failed'],
      secret: 'whsec_xxx',
      active: true,
    },
    {
      id: '2',
      name: t('examples.subscriptionUpdates'),
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
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{t('title')}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('subtitle')}
            </p>
          </div>
          <Button iconLeft={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
            {t('newWebhook')}
          </Button>
        </div>

        {showForm && (
          <Card className="mb-xl" padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('newWebhook')}</h3>
            </CardHeader>
            <CardContent className="space-y-lg">
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface">{t('webhookName')}</label>
                <Input placeholder={t('namePlaceholder')} />
              </div>
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface">{t('endpointUrl')}</label>
                <Input placeholder={t('urlPlaceholder')} />
              </div>
              <div className="space-y-sm">
                <label className="font-label-md text-label-md text-on-surface">{t('eventsToSubscribe')}</label>
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
                  {t('common.cancel')}
                </Button>
                <Button iconLeft={<Save className="w-4 h-4" />}>{t('saveWebhook')}</Button>
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
                      {webhook.active ? t('common.active') : t('common.inactive')}
                    </Badge>
                    <Button variant="ghost" size="sm">{t('edit')}</Button>
                    <Button variant="ghost" size="sm" className="text-destructive">{t('delete')}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="!p-0 mt-lg">
                <div className="bg-surface rounded-xl p-md">
                  <p className="font-label-sm text-label-sm text-on-surface-variant mb-sm">{t('subscribedEvents')}</p>
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
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{t('signingSecret')}</p>
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
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('testing')}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {t('testingDescription')}
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
