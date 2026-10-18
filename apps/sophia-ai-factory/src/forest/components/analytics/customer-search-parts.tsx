'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/seed/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/seed/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/seed/components/ui/popover';
import { Button } from '@/seed/components/ui/button';
import type { Customer } from './customer-search';

export function SelectedCustomerBadge({
  customer,
  onClear,
}: {
  customer: Customer;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
      <span className="text-sm">
        {customer.email} ({customer.tier})
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-auto p-1"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function CustomerSearchPopover({
  open,
  onOpenChange,
  placeholder,
  query,
  onQueryChange,
  loading,
  customers,
  onSelectCustomer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => onOpenChange(true)}
            className="pl-9 w-[300px]"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>
              {loading ? 'Searching...' : 'No customers found.'}
            </CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  onSelect={() => onSelectCustomer(customer)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  <div>
                    <div className="font-medium">{customer.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Tier: {customer.tier}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
