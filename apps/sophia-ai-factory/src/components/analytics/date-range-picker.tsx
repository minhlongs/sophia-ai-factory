'use client';

/**
 * DateRangePicker — Enhanced picker with ISO string output, preset buttons, and URL sync.
 *
 * Props accept/emit ISO date strings (YYYY-MM-DD) alongside the original DateRange.
 * Presets: 7d, 30d, 90d, month, last-month + custom calendar mode.
 */

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from 'next-intl';

// ── ISO range ────────────────────────────────────────────────────────────────

/** ISO 8601 date range emitted by onChange */
export interface ISODateRange {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
  fromDate: Date;
  toDate: Date;
}

// ── Presets ──────────────────────────────────────────────────────────────────

type PresetKey = '7d' | '30d' | '90d' | 'month' | 'last-month';

interface DaysPreset { label: string; days: number }
interface TypePreset { label: string; type: 'current' | 'previous' }
type PresetConfig = DaysPreset | TypePreset;

const PRESETS: Record<PresetKey, PresetConfig> = {
  '7d':         { label: 'Last 7 days',  days: 7 },
  '30d':        { label: 'Last 30 days', days: 30 },
  '90d':        { label: 'Last 90 days', days: 90 },
  'month':      { label: 'This month',   type: 'current' },
  'last-month': { label: 'Last month',   type: 'previous' },
};

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface DateRangePickerProps {
  /** Legacy DateRange compatibility */
  value?: DateRange;
  /** Legacy callback (DateRange) */
  onChange?: (range: DateRange) => void;
  /** Enhanced ISO callback — called alongside onChange */
  onISOChange?: (range: ISODateRange) => void;
  presets?: PresetKey[];
  maxRangeDays?: number;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({
  value,
  onChange,
  onISOChange,
  presets = ['7d', '30d', '90d', 'month', 'last-month'],
  maxRangeDays = 365,
  className,
}: DateRangePickerProps) {
  const t = useTranslations('dashboard.analytics');
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(value);

  const emitRange = useCallback((range: DateRange) => {
    setDate(range);
    onChange?.(range);
    if (range.from && range.to) {
      onISOChange?.({
        from: toISO(range.from),
        to: toISO(range.to),
        fromDate: range.from,
        toDate: range.to,
      });
    }
  }, [onChange, onISOChange]);

  const applyPreset = (preset: PresetKey) => {
    const config = PRESETS[preset];
    const now = new Date();
    let from = new Date(now);
    let to = new Date(now);

    if ('days' in config) {
      from.setDate(now.getDate() - config.days);
    } else if (config.type === 'current') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    emitRange({ from, to });
    setOpen(false);
  };

  const handleDateSelect = (newDate: DateRange | undefined) => {
    setDate(newDate);
    if (newDate?.from && newDate?.to) {
      const diffDays = (newDate.to.getTime() - newDate.from.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > maxRangeDays) return;
      emitRange(newDate);
      setOpen(false);
    }
  };

  const displayValue = date?.from
    ? date.to
      ? `${format(date.from, 'LLL dd, y')} - ${format(date.to, 'LLL dd, y')}`
      : format(date.from, 'LLL dd, y')
    : t('date_range_placeholder') || 'Pick a date range';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((key) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => applyPreset(key)}
            >
              {PRESETS[key].label}
            </Button>
          ))}
        </div>
        {/* Calendar */}
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={handleDateSelect}
          numberOfMonths={2}
        />
        {/* Custom date inputs as fallback */}
        <div className="flex gap-2 mt-3 pt-3 border-t">
          <input
            type="date"
            className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1"
            value={date?.from ? toISO(date.from) : ''}
            onChange={e => {
              const from = e.target.value ? new Date(e.target.value) : undefined;
              if (from) setDate(prev => ({ from, to: prev?.to }));
            }}
          />
          <span className="text-muted-foreground text-xs self-center">to</span>
          <input
            type="date"
            className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1"
            value={date?.to ? toISO(date.to) : ''}
            onChange={e => {
              const to = e.target.value ? new Date(e.target.value) : undefined;
              if (to && date?.from) {
                const newRange = { from: date.from, to };
                emitRange(newRange);
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
