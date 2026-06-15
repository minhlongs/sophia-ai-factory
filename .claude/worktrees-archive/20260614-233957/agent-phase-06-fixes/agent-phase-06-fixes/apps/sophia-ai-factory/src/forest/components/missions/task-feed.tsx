'use client';

/**
 * TaskFeed — SSE consumer showing live task events in scrollable list
 */

import { useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { useAgentStream } from '@/forest/hooks/use-agent-stream';
import type { AgentEvent } from '@/forest/hooks/use-agent-stream';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function eventBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.includes('completed')) return 'default';
  if (type.includes('failed')) return 'destructive';
  if (type.includes('started') || type.includes('running')) return 'secondary';
  return 'outline';
}

function EventRow({ event }: { event: AgentEvent }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 w-20">
        {formatTime(event.receivedAt)}
      </span>
      <Badge variant={eventBadgeVariant(event.type)} className="text-xs shrink-0">
        {event.type.replace('agent.task.', '')}
      </Badge>
      <p className="text-xs text-foreground truncate flex-1">
        {event.input ?? event.errorMessage ?? event.taskId ?? event.type}
      </p>
    </div>
  );
}

export function TaskFeed() {
  const t = useTranslations('dashboard.missions.control');
  const { events, connected } = useAgentStream();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only when at bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">stream</span>
            {t('task_feed')}
          </CardTitle>
          <Badge variant={connected ? 'default' : 'destructive'} className="text-xs">
            {connected ? t('connected') : t('disconnected')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="max-h-96 overflow-y-auto space-y-0"
        >
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {t('no_events')}
            </p>
          ) : (
            events.map((event, i) => (
              <EventRow key={`${event.taskId ?? ''}-${event.receivedAt}-${i}`} event={event} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </CardContent>
    </Card>
  );
}
