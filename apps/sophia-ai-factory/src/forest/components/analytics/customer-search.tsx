'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/seed/utils/cn';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  SelectedCustomerBadge,
  CustomerSearchPopover,
} from './customer-search-parts';

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
        <SelectedCustomerBadge customer={selectedCustomer} onClear={handleClear} />
      ) : (
        <CustomerSearchPopover
          open={open}
          onOpenChange={setOpen}
          placeholder={placeholder}
          query={query}
          onQueryChange={setQuery}
          loading={loading}
          customers={customers}
          onSelectCustomer={handleSelect}
        />
      )}
    </div>
  );
}
