'use client';

import React from 'react';
import { Button } from '@/seed/components/ui/button';
import { Calendar } from '@/seed/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { PRESETS, toISO, type PresetKey } from './date-range-presets';

export interface DateRangePickerContentProps {
  presets: PresetKey[];
  date: DateRange | undefined;
  onApplyPreset: (preset: PresetKey) => void;
  onDateSelect: (newDate: DateRange | undefined) => void;
  onFromInputChange: (value: string) => void;
  onToInputChange: (value: string) => void;
}

export function DateRangePickerContent({
  presets,
  date,
  onApplyPreset,
  onDateSelect,
  onFromInputChange,
  onToInputChange,
}: DateRangePickerContentProps) {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((key) => (
          <Button key={key} variant="ghost" size="sm" onClick={() => onApplyPreset(key)}>
            {PRESETS[key].label}
          </Button>
        ))}
      </div>
      <Calendar
        initialFocus
        mode="range"
        defaultMonth={date?.from}
        selected={date}
        onSelect={onDateSelect}
        numberOfMonths={2}
      />
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <input
          type="date"
          className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1"
          value={date?.from ? toISO(date.from) : ''}
          onChange={(e) => onFromInputChange(e.target.value)}
        />
        <span className="text-muted-foreground text-xs self-center">to</span>
        <input
          type="date"
          className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1"
          value={date?.to ? toISO(date.to) : ''}
          onChange={(e) => onToInputChange(e.target.value)}
        />
      </div>
    </>
  );
}
