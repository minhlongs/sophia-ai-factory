'use client';

/**
 * Marketplace Catalog Component — Responsive Grid of Blueprints
 *
 * Layer: land (pure UI component)
 *
 * @module land/marketplace/marketplace-catalog
 */

import React from 'react';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import { BlueprintCard } from './blueprint-card';
import { MarketplaceEmptyState } from './marketplace-empty-state';
import { MarketplacePagination } from './marketplace-pagination';

export interface MarketplaceCatalogProps {
  blueprints: MarketplaceBlueprintItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function MarketplaceCatalog({
  blueprints,
  total,
  page,
  pageSize,
  totalPages,
}: MarketplaceCatalogProps) {
  if (blueprints.length === 0) {
    return <MarketplaceEmptyState />;
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {blueprints.map((blueprint) => (
          <BlueprintCard key={blueprint.id} blueprint={blueprint} />
        ))}
      </div>

      <MarketplacePagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
      />
    </div>
  );
}
