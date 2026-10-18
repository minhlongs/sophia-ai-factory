import type { CalendarStatus } from '@/land/youtube/content-calendar';

export interface CalendarEntry {
  id: string;
  title: string;
  scheduledAt: string;
  status: CalendarStatus;
  contentType?: string | null;
  topic?: string | null;
}

export const STATUS_CLASSES: Record<CalendarStatus, string> = {
  scheduled: 'bg-sky-50 border-sky-200 text-sky-700',
  generating: 'bg-amber-50 border-amber-200 text-amber-700',
  ready: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  published: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  failed: 'bg-rose-50 border-rose-200 text-rose-700',
  cancelled: 'bg-gray-50 border-gray-200 text-gray-500',
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface CalendarCell {
  date: Date;
  key: string;
  inMonth: boolean;
  entries: CalendarEntry[];
}

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildMonthDays(entries: readonly CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const day = dayKey(new Date(entry.scheduledAt));
    const existing = map.get(day);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(day, [entry]);
    }
  }
  return map;
}

export function buildCells(entries: readonly CalendarEntry[]): CalendarCell[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const byDay = buildMonthDays(entries);

  const cells: CalendarCell[] = [];

  const firstWeekday = start.getDay();
  const prevCursor = new Date(start);
  for (let i = firstWeekday - 1; i >= 0; i--) {
    prevCursor.setDate(prevCursor.getDate() - 1);
    const key = dayKey(prevCursor);
    cells.push({
      date: new Date(prevCursor),
      key,
      inMonth: false,
      entries: byDay.get(key) ?? [],
    });
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = dayKey(cursor);
    cells.push({
      date: new Date(cursor),
      key,
      inMonth: true,
      entries: byDay.get(key) ?? [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}
