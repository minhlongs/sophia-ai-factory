'use client';

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

export interface Customer {
  id: string;
  email: string;
  tier: string;
}

export interface CustomerSearchProps {
  onSelect: (customerId: string) => void;
  onClear?: () => void;
  placeholder?: string;
  adminOnly?: boolean;
  className?: string;
}

export function CustomerSearch({
  onSelect,
  onClear,
  placeholder = 'Search customers...',
  adminOnly = false,
  className,
}: CustomerSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = (await res.json()) as Customer[];
            setCustomers(data);
          }
        } catch (error) {
          logger.error('Failed to search customers', toError(error));
        } finally {
          setLoading(false);
        }
      } else {
        setCustomers([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    onSelect(customer.id);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    setQuery('');
    setCustomers([]);
    onClear?.();
  };

  if (adminOnly) {
    return null; // Hide for non-admin users
  }

  return (
    <div className={cn('relative', className)}>
      {selectedCustomer ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
          <span className="text-sm">
            {selectedCustomer.email} ({selectedCustomer.tier})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-auto p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setOpen(true)}
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
                      onSelect={() => handleSelect(customer)}
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
      )}
    </div>
  );
}
