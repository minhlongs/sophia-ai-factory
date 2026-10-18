'use client';

import React from 'react';
import { Save } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Badge } from '@/components/stitch';

export interface WebhookEndpointItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export interface NewWebhookFormCardProps {
  availableEvents: string[];
  onCancel: () => void;
}

export function NewWebhookFormCard({ availableEvents, onCancel }: NewWebhookFormCardProps) {
  return (
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button iconLeft={<Save className="w-4 h-4" />}>Save Webhook</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WebhookItemCard({ webhook }: { webhook: WebhookEndpointItem }) {
  return (
    <Card padding="lg">
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
  );
}
