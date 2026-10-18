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
import { cn } from '@/seed/utils/cn';
import { Button } from '@/seed/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/seed/components/ui/popover';
import { useTranslations } from 'next-intl';
import {
  toISO,
  resolvePresetDateRange,
  type ISODateRange,
  type PresetKey,
} from './date-range-presets';
import {
  DateRangePickerContent,
  type DateRangePickerContentProps,
} from './date-range-picker-content';

export type { ISODateRange, DateRangePickerContentProps };
export { DateRangePickerContent };

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
    emitRange(resolvePresetDateRange(preset));
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
            'w-full sm:w-[280px] justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <DateRangePickerContent
          presets={presets}
          date={date}
          onApplyPreset={applyPreset}
          onDateSelect={handleDateSelect}
          onFromInputChange={(val) => {
            const from = val ? new Date(val) : undefined;
            if (from) setDate((prev) => ({ from, to: prev?.to }));
          }}
          onToInputChange={(val) => {
            const to = val ? new Date(val) : undefined;
            if (to && date?.from) {
              emitRange({ from: date.from, to });
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
