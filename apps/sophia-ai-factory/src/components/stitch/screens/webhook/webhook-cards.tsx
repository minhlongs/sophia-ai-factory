'use client';

import React, { useState } from 'react';
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
  onSave?: (input: { name: string; url: string; events: string[] }) => void | Promise<void>;
}

export function NewWebhookFormCard({ availableEvents, onCancel, onSave }: NewWebhookFormCardProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([availableEvents[0] ?? 'payment.received']);

  const toggleEvent = (evt: string) => {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt],
    );
  };

  return (
    <Card className="mb-xl" padding="lg">
      <CardHeader>
        <h3 className="font-headline-sm text-headline-sm text-on-surface">New Webhook</h3>
      </CardHeader>
      <CardContent className="space-y-lg">
        <div className="space-y-sm">
          <label className="font-label-md text-label-md text-on-surface">Webhook Name</label>
          <Input placeholder="e.g., Payment Events" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-sm">
          <label className="font-label-md text-label-md text-on-surface">Endpoint URL</label>
          <Input placeholder="https://your-app.com/api/webhooks/events" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="space-y-sm">
          <label className="font-label-md text-label-md text-on-surface">Events to Subscribe</label>
          <div className="flex flex-wrap gap-sm">
            {availableEvents.map((event) => (
              <label key={event} className="flex items-center gap-sm px-sm py-1 bg-surface rounded-full cursor-pointer hover:bg-surface-container">
                <input type="checkbox" checked={selectedEvents.includes(event)} onChange={() => toggleEvent(event)} className="w-4 h-4 text-primary" />
                <span className="text-sm text-on-surface">{event}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-sm justify-end pt-md border-t border-outline-variant">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button iconLeft={<Save className="w-4 h-4" />} onClick={() => onSave?.({ name, url, events: selectedEvents })}>Save Webhook</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WebhookItemCard({
  webhook,
  onDelete,
  onToggle,
}: {
  webhook: WebhookEndpointItem;
  onDelete?: (id: string) => void;
  onToggle?: (id: string, active: boolean) => void;
}) {
  return (
    <Card padding="lg">
      <CardHeader className="!p-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{webhook.name}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant font-mono mt-xs">{webhook.url}</p>
          </div>
          <div className="flex items-center gap-sm">
            <Badge variant={webhook.active ? 'soft' : 'outline'} color={webhook.active ? 'success' : 'neutral'}>
              {webhook.active ? 'Active' : 'Disabled'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => onToggle?.(webhook.id, !webhook.active)}>Edit</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete?.(webhook.id)}>Delete</Button>
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
