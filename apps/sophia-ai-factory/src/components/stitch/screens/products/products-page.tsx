'use client';

import React, { useState } from 'react';
import { Plus, Search, MoreVertical } from 'lucide-react';
import { DashboardLayout, Card, Button, Input } from '@/components/stitch';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { ProductsGrid, ProductsTableSection } from './products-catalog-sections';
export { ProductsGrid, ProductsTableSection } from './products-catalog-sections';

export interface ProductItem {
  id: string;
  name: string;
  type: string;
  price: string;
  status: 'active' | 'draft' | 'archived';
  subscribers: number;
}

export interface ProductsPageProps {
  initialProducts?: ProductItem[];
}

/**
 * Authentic Sophia AI Factory Tiers as default catalog items.
 * Guaranteed 0-subscriber initial baseline — no synthetic numbers.
 */
export const CANONICAL_TIER_PRODUCTS: ProductItem[] = [
  {
    id: 'starter',
    name: `${UNIFIED_TIERS.BASIC.name} Plan`,
    type: 'Autonomous Video Generation',
    price: `$${UNIFIED_TIERS.BASIC.price}`,
    status: 'active',
    subscribers: 0,
  },
  {
    id: 'growth',
    name: `${UNIFIED_TIERS.PREMIUM.name} Plan`,
    type: 'Multi-Channel AI Studio',
    price: `$${UNIFIED_TIERS.PREMIUM.price}`,
    status: 'active',
    subscribers: 0,
  },
  {
    id: 'scale',
    name: `${UNIFIED_TIERS.ENTERPRISE.name} Plan`,
    type: 'Enterprise Agency Automation',
    price: `$${UNIFIED_TIERS.ENTERPRISE.price}`,
    status: 'active',
    subscribers: 0,
  },
  {
    id: 'master',
    name: `${UNIFIED_TIERS.MASTER.name} License`,
    type: 'Perpetual Factory License',
    price: `$${UNIFIED_TIERS.MASTER.price}`,
    status: 'active',
    subscribers: 0,
  },
];

export default function ProductsPage({ initialProducts }: ProductsPageProps = {}) {
  const [search, setSearch] = useState('');

  const productList = initialProducts ?? CANONICAL_TIER_PRODUCTS;
  const filteredProducts = productList.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout
      title="Products"
      subtitle="Manage your product catalog and pricing tiers"
      actions={
        <Button iconLeft={<Plus className="w-4 h-4" />}>
          Add Product
        </Button>
      }
    >
      {/* Search & Filter Bar */}
      <Card className="mb-xl" padding="md">
        <div className="flex items-center gap-md">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Products Grid */}
      <ProductsGrid products={filteredProducts} />

      {/* Products Table */}
      <ProductsTableSection products={filteredProducts} />
    </DashboardLayout>
  );
}
