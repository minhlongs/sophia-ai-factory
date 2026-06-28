---
title: "Phase 3: Filters & Controls"
status: completed
priority: P2
effort: 2h
completed: 2026-03-07
---

# Phase 3: Filters & Controls

## Context

**Existing UI Components:**
- shadcn/ui: Select, Popover, Calendar, Button
- Date picker patterns in codebase

**Requirement:** User-friendly controls for filtering analytics data

## Requirements

### 3.1 Date Range Picker
**Purpose:** Select time period for analytics

**Features:**
- Preset ranges: Last 7 days, Last 30 days, This month, Last month
- Custom range (calendar popover)
- Max range validation (90 days)
- Display selected range in header

**UI Pattern:**
```tsx
<DateRangePicker
  presets={['7d', '30d', 'month', 'last-month']}
  maxRangeDays={90}
  onChange={(range) => handleDateChange(range)}
/>
```

### 3.2 Tier Filter Dropdown
**Purpose:** Filter by tier (admin only)

**Features:**
- Multi-select checkboxes
- Options: BASIC, PREMIUM, ENTERPRISE, MASTER
- "Select All" option
- Clear all button

**UI Pattern:**
```tsx
<TierFilter
  selectedTiers={['PREMIUM', 'ENTERPRISE']}
  onChange={(tiers) => handleTierChange(tiers)}
  adminOnly={true}
/>
```

### 3.3 Customer Search
**Purpose:** Search customers by email or ID (admin only)

**Features:**
- Debounced input (300ms)
- Autocomplete suggestions
- Click to select
- Clear button

**UI Pattern:**
```tsx
<CustomerSearch
  onSelect={(customerId) => handleCustomerSelect(customerId)}
  placeholder="Search by email or customer ID..."
/>
```

### 3.4 Service Filter
**Purpose:** Filter by AI service

**Features:**
- Checkbox group
- Options: HeyGen, ElevenLabs, OpenRouter
- Show usage count per service

### 3.5 Export Button
**Purpose:** Download CSV/PDF report

**Features:**
- Format toggle: CSV | PDF
- Disabled for BASIC tier (upgrade prompt)
- Loading state during export
- Download filename: `analytics-{date}-{date}.csv`

**UI Pattern:**
```tsx
<ExportButton
  disabled={userTier === 'BASIC'}
  onExport={(format) => handleExport(format)}
  loading={isExporting}
>
  Export Report
</ExportButton>
```

### 3.6 Refresh Control
**Purpose:** Manual data refresh

**Features:**
- Refresh button with spinner
- Auto-refresh toggle (30s, 60s, off)
- Last updated timestamp

## Files to Create

**Create:**
```
src/app/[locale]/dashboard/analytics/components/
├── date-range-picker.tsx     # Date range selector
├── tier-filter.tsx           # Tier dropdown
├── customer-search.tsx       # Customer search input
├── service-filter.tsx        # Service checkboxes
├── export-button.tsx         # Export control
└── refresh-control.tsx       # Refresh button + auto-refresh
```

## Implementation Steps

### Step 1: Create Date Range Picker
```tsx
'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

const PRESETS = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  'month': { label: 'This month', type: 'current' },
  'last-month': { label: 'Last month', type: 'previous' },
};

export function DateRangePicker({ onChange, maxRangeDays = 90 }: DateRangePickerProps) {
  const [date, setDate] = useState<DateRange | undefined>();
  const [open, setOpen] = useState(false);

  const applyPreset = (preset: string) => {
    const config = PRESETS[preset as keyof typeof PRESETS];
    const now = new Date();
    let from = new Date();

    if ('days' in config) {
      from.setDate(now.getDate() - config.days);
    } else if (config.type === 'current') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      now.setDate(0); // Last day of previous month
    }

    setDate({ from, to: now });
    onChange({ from, to });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          {date?.from ? (
            date.to ? (
              `${format(date.from, 'LLL dd, y')} - ${format(date.to, 'LLL dd, y')}`
            ) : (
              format(date.from, 'LLL dd, y')
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex gap-2 mb-4">
          {Object.entries(PRESETS).map(([key, config]) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => applyPreset(key)}
            >
              {config.label}
            </Button>
          ))}
        </div>
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
```

### Step 2: Create Tier Filter
```tsx
'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

export function TierFilter({ selectedTiers, onChange }: TierFilterProps) {
  const handleToggle = (tier: string) => {
    const newTiers = selectedTiers.includes(tier)
      ? selectedTiers.filter((t) => t !== tier)
      : [...selectedTiers, tier];
    onChange(newTiers);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Tier: {selectedTiers.length === 0 ? 'All' : selectedTiers.join(', ')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {TIERS.map((tier) => (
          <DropdownMenuCheckboxItem
            key={tier}
            checked={selectedTiers.includes(tier)}
            onCheckedChange={() => handleToggle(tier)}
          >
            {tier}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 3: Create Customer Search
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function CustomerSearch({ onSelect }: CustomerSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        const res = await fetch(`/api/admin/customers/search?q=${query}`);
        const data = await res.json();
        setCustomers(data);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          placeholder="Search customers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="w-[300px]"
        />
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>No customers found.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  onSelect={() => {
                    onSelect(customer.id);
                    setOpen(false);
                  }}
                >
                  {customer.email} ({customer.tier})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Step 4: Create Export Button
```tsx
'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ExportButton({
  disabled,
  onExport,
  loading,
}: ExportButtonProps) {
  if (disabled) {
    return (
      <Tooltip content="Upgrade to PREMIUM for exports">
        <Button disabled variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={loading}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onExport('csv')}>
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('pdf')}>
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 5: Integrate Controls in Analytics Page
```tsx
// src/app/[locale]/dashboard/analytics/page.tsx
export default function AnalyticsView({ userId, userTier }) {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange());
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'pdf') => {
    const res = await fetch('/api/analytics/export', {
      method: 'POST',
      body: JSON.stringify({
        format,
        dateRange,
        tiers: selectedTiers,
        customerId: selectedCustomer,
      }),
    });

    const blob = await res.blob();
    downloadBlob(blob, `analytics-${Date.now()}.${format}`);
  };

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex gap-4 items-center">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          maxRangeDays={90}
        />
        {userTier === 'MASTER' && (
          <>
            <TierFilter
              selectedTiers={selectedTiers}
              onChange={setSelectedTiers}
            />
            <CustomerSearch onSelect={setSelectedCustomer} />
          </>
        )}
        <ExportButton
          disabled={userTier === 'BASIC'}
          onExport={handleExport}
        />
      </div>

      {/* Dashboard Content */}
      <AnalyticsDashboard
        dateRange={dateRange}
        filters={{ tiers: selectedTiers, customerId: selectedCustomer }}
      />
    </div>
  );
}
```

## Success Criteria

- [ ] All 6 filter components render and function
- [ ] Date range validation (max 90 days enforced)
- [ ] Tier filter only visible to MASTER tier
- [ ] Customer search debounced correctly (300ms)
- [ ] Export button disabled for BASIC tier with tooltip

## Related Files

**Create:**
- 6 filter/control components
- Update analytics page to integrate controls

**Dependencies:**
- shadcn/ui components (Calendar, Popover, DropdownMenu, etc.)
