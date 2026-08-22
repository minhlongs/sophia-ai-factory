/**
 * Content calendar grid — month view of scheduled content slots.
 * Pure presentational component.
 */

import type { CalendarStatus } from '@/land/youtube/content-calendar';

export interface CalendarEntry {
  id: string;
  title: string;
  scheduledAt: string;
  status: CalendarStatus;
  contentType?: string | null;
  topic?: string | null;
}

interface ContentCalendarGridProps {
  entries: readonly CalendarEntry[];
  onEntryClick?: (entry: CalendarEntry) => void;
}

const STATUS_CLASSES: Record<CalendarStatus, string> = {
  scheduled: 'bg-sky-50 border-sky-200 text-sky-700',
  generating: 'bg-amber-50 border-amber-200 text-amber-700',
  ready: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  published: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  failed: 'bg-rose-50 border-rose-200 text-rose-700',
  cancelled: 'bg-gray-50 border-gray-200 text-gray-500',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface CalendarCell {
  date: Date;
  key: string;
  inMonth: boolean;
  entries: CalendarEntry[];
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthDays(entries: readonly CalendarEntry[]): Map<string, CalendarEntry[]> {
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

function buildCells(entries: readonly CalendarEntry[]): CalendarCell[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const byDay = buildMonthDays(entries);

  const cells: CalendarCell[] = [];

  // Leading cells from previous month to align the first weekday.
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

  // Current month cells.
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

export function ContentCalendarGrid({ entries, onEntryClick }: ContentCalendarGridProps) {
  const cells = buildCells(entries);

  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-r border-border px-2 py-2 text-xs font-medium text-muted-foreground last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-7 border-b border-border last:border-b-0"
        >
          {row.map((cell) => (
            <div
              key={cell.key}
              className={`min-h-[80px] border-r border-border p-1.5 last:border-r-0 ${
                cell.inMonth ? 'bg-background' : 'bg-muted/30'
              }`}
            >
              <div
                className={`text-xs font-medium ${
                  cell.inMonth ? 'text-foreground' : 'text-muted-foreground/60'
                }`}
              >
                {cell.date.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {cell.entries.slice(0, 2).map((entry) => {
                  const badgeClass =
                    STATUS_CLASSES[entry.status] ?? STATUS_CLASSES.scheduled;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onEntryClick?.(entry)}
                      title={entry.title}
                      className={`w-full truncate rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
                    >
                      {entry.title}
                    </button>
                  );
                })}
                {cell.entries.length > 2 && (
                  <p className="px-1.5 text-[10px] text-muted-foreground">
                    +{cell.entries.length - 2} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}