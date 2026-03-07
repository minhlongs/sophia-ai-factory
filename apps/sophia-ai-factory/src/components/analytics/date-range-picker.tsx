'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from 'next-intl';

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  presets?: ('7d' | '30d' | 'month' | 'last-month')[];
  maxRangeDays?: number;
  className?: string;
}

const PRESETS = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  'month': { label: 'This month', type: 'current' as const },
  'last-month': { label: 'Last month', type: 'previous' as const },
};

export function DateRangePicker({
  value,
  onChange,
  presets = ['7d', '30d', 'month', 'last-month'],
  maxRangeDays = 90,
  className,
}: DateRangePickerProps) {
  const t = useTranslations('dashboard.analytics');
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(value);

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const config = PRESETS[preset];
    const now = new Date();
    let from = new Date();
    let to = new Date();

    if ('days' in config) {
      from.setDate(now.getDate() - config.days);
    } else if (config.type === 'current') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const newRange = { from, to };
    setDate(newRange);
    onChange?.(newRange);
    setOpen(false);
  };

  const handleDateSelect = (newDate: DateRange | undefined) => {
    setDate(newDate);
    if (newDate?.from && newDate?.to) {
      // Validate max range
      const diffDays = (newDate.to.getTime() - newDate.from.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > maxRangeDays) {
        return; // Don't apply if exceeds max range
      }
      onChange?.(newDate);
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
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={handleDateSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
