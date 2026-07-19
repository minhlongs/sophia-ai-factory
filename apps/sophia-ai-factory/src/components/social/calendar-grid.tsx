/**
 * CalendarGrid — shared calendar component used by
 * the Social Calendar page (desktop: grid, mobile: list).
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
  addMonths,
  subMonths,
  format,
} from 'date-fns';

const CHANNEL_COLORS: Record<string, string> = {
  youtube: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  tiktok: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  instagram: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  facebook: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  telegram: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

export interface CalendarEvent {
  id: number;
  provider: string;
  content_title: string;
  scheduled_at: number;
  status: string;
  confidence: number;
}

export interface CalendarGridProps {
  events: CalendarEvent[];
  onDateClick?: (dateStr: string) => void;
  onEventDrop?: (eventId: number, newDateStr: string) => void;
}

export function CalendarGrid({
  events,
  onDateClick,
  onEventDrop,
}: CalendarGridProps) {
  const t = useTranslations('socialPages.calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }),
    [currentMonth],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dayKey = format(new Date(event.scheduled_at * 1000), 'yyyy-MM-dd');
      const list = map.get(dayKey) ?? [];
      list.push(event);
      map.set(dayKey, list);
    }
    return map;
  }, [events]);

  const confidenceBorder = (conf: number): string => {
    if (conf >= 0.7) return 'border-l-green-500';
    if (conf >= 0.4) return 'border-l-yellow-500';
    return 'border-l-gray-300';
  };

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth((m: Date) => subMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h3 className="text-lg font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          type="button"
          onClick={() => setCurrentMonth((m: Date) => addMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="hidden md:grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="bg-background p-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {daysInMonth.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dayKey}
              className={`bg-background p-1.5 min-h-[70px] cursor-pointer transition-colors hover:bg-muted/50 ${
                isToday ? 'ring-1 ring-primary/40 rounded-md' : ''
              }`}
              onClick={() => onDateClick?.(dayKey)}
            >
              <span
                className={`text-xs font-medium ${
                  isToday ? 'text-primary font-bold' : 'text-foreground'
                }`}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-[10px] px-1.5 py-0.5 rounded border-l-2 ${CHANNEL_COLORS[ev.provider] ?? 'bg-muted'} ${confidenceBorder(ev.confidence)}`}
                  >
                    <p className="truncate font-medium">{ev.content_title}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(ev.scheduled_at * 1000), 'HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile list (simple fallback) */}
      <div className="md:hidden space-y-2">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('noEvents')}
          </p>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className={`p-3 rounded-lg border-l-4 ${confidenceBorder(ev.confidence)} ${CHANNEL_COLORS[ev.provider] ?? ''}`}
            >
              <p className="font-medium text-sm">{ev.content_title}</p>
              <p className="text-xs text-muted-foreground">
                {ev.provider.toUpperCase()} ·{' '}
                {format(new Date(ev.scheduled_at * 1000), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
