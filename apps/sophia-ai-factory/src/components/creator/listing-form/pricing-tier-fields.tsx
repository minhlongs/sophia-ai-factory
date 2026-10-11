'use client';

import React from 'react';
import type { ListingFormInitialData } from './types';

interface PricingTierFieldsProps {
  initialData?: ListingFormInitialData;
  t: (key: string) => string;
}

export function PricingTierFields({ initialData, t }: PricingTierFieldsProps) {
  const defaultPrice =
    initialData !== undefined
      ? (initialData.priceCents / 100).toFixed(2)
      : '';

  return (
    <div>
      <label
        htmlFor="price"
        className="mb-1 block text-sm font-medium text-foreground"
      >
        {t('price')}
      </label>
      <input
        id="price"
        name="price"
        type="number"
        step="0.01"
        min="0"
        required
        defaultValue={defaultPrice}
        placeholder={t('pricePlaceholder')}
        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
