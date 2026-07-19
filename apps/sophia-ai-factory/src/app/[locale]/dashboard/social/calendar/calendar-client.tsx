/**
 * Client component for Publishing Calendar page.
 * Renders responsive calendar view (grid on desktop, list on mobile).
 */

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';

interface CalendarEvent {
  id: number;
  provider: string;
  content_title: string;
  scheduled_at: number;
  status: string;
  confidence: number;
}

interface CalendarClientProps {
  userId: string;
  initialEvents: CalendarEvent[];
}

const CHANNEL_COLORS: Record<string, string> = {
  youtube: 'bg-red-100 text-red-700 border-red-200',
  tiktok: 'bg-pink-100 text-pink-700 border-pink-200',
  instagram: 'bg-purple-100 text-purple-700 border-purple-200',
  facebook: 'bg-blue-100 text-blue-700 border-blue-200',
  telegram: 'bg-sky-100 text-sky-700 border-sky-200',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-gray-300',
};

function getConfidenceLevel(conf: number): string {
  if (conf >= 0.7) return 'high';
  if (conf >= 0.4) return 'medium';
  return 'low';
}

export default function CalendarClient({
  userId,
  initialEvents = [],
}: CalendarClientProps) {
  const t = useTranslations('socialPages.calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

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
    for (const event of initialEvents) {
      const dayKey = format(new Date(event.scheduled_at * 1000), 'yyyy-MM-dd');
      const existing = map.get(dayKey) ?? [];
      existing.push(event);
      map.set(dayKey, existing);
    }
    return map;
  }, [initialEvents]);

  const confidenceLabel = (conf: number): string => {
    const level = getConfidenceLevel(conf);
    const key = `confidence.${level}`;
    return t(key);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            {viewMode === 'calendar' ? t('viewList') : t('viewCalendar')}
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          type="button"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Calendar Grid (desktop) */}
      {viewMode === 'calendar' && !isMobile && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
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
                className={`bg-background p-1.5 min-h-[70px] ${
                  isToday ? 'ring-1 ring-primary/40 rounded-md' : ''
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isToday ? 'text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.map((ev) => {
                    const channel = ev.provider.toLowerCase();
                    const confLevel = getConfidenceLevel(ev.confidence);
                    return (
                      <div
                        key={ev.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded border-l-2 ${CHANNEL_COLORS[channel] ?? 'bg-muted'} ${CONFIDENCE_COLORS[confLevel]}`}
                      >
                        <p className="truncate font-medium">{ev.content_title}</p>
                        <p className="text-muted-foreground">
                          {confidenceLabel(ev.confidence)} · {format(new Date(ev.scheduled_at * 1000), 'HH:mm')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view (mobile or selected) */}
      {(viewMode === 'list' || isMobile) && (
        <div className="space-y-3">
          {initialEvents.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">{t('noEvents')}</p>
            </div>
          ) : (
            initialEvents.map((ev) => {
              const channel = ev.provider.toLowerCase();
              const confLevel = getConfidenceLevel(ev.confidence);
              return (
                <div
                  key={ev.id}
                  className={`bg-card border border-border rounded-xl p-4 border-l-4 ${CONFIDENCE_COLORS[confLevel]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {ev.content_title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ev.provider.toUpperCase()} ·{' '}
                        {format(new Date(ev.scheduled_at * 1000), 'dd MMM yyyy, HH:mm')}
                      </p>
                      <span
                        className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full ${CHANNEL_COLORS[channel] ?? 'bg-muted'}`}
                      >
                        {confidenceLabel(ev.confidence)}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        ev.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : ev.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
