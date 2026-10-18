/**
 * Content calendar grid — month view of scheduled content slots.
 * Pure presentational component.
 */

import {
  STATUS_CLASSES,
  WEEKDAYS,
  buildCells,
  type CalendarCell,
  type CalendarEntry,
} from './content-calendar-grid-helpers';

export type { CalendarEntry };

interface ContentCalendarGridProps {
  entries: readonly CalendarEntry[];
  onEntryClick?: (entry: CalendarEntry) => void;
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
