'use client';

import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Eye } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Badge, Table, Input } from '@/components/stitch';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg mb-xl">
        {filteredProducts.map((product) => (
          <Card key={product.id} hoverable padding="lg">
            <CardHeader className="!p-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-xs">
                    {product.name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {product.type}
                  </p>
                </div>
                <Badge variant="soft" color={product.status === 'active' ? 'success' : 'neutral'}>
                  {product.status}
                </Badge>
              </div>
              <div className="mt-md">
                <span className="text-2xl font-bold text-on-surface">{product.price}</span>
                {product.price !== 'Custom' && (
                  <span className="text-on-surface-variant text-body-sm">/month</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="!p-0 mt-lg">
              <div className="flex items-center justify-between pt-lg border-t border-outline-variant">
                <div className="text-on-surface-variant">
                  <p className="font-body-sm">{product.subscribers} subscribers</p>
                </div>
                <div className="flex gap-sm">
                  <Button variant="ghost" size="sm" iconLeft={<Eye className="w-4 h-4" />}>
                    View
                  </Button>
                  <Button variant="ghost" size="sm" iconLeft={<Edit className="w-4 h-4" />}>
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <h4 className="font-headline-sm text-headline-sm text-on-surface">All Products</h4>
        </CardHeader>
        <CardContent>
          <Table
            data={filteredProducts}
            emptyMessage="No products configured yet. Click 'Add Product' to create a new package."
            columns={[
              { key: 'name', header: 'Product', cell: (row) => (
                <div>
                  <p className="font-label-md text-on-surface font-medium">{row.name}</p>
                  <p className="text-[12px] text-on-surface-variant">{row.type}</p>
                </div>
              ) },
              { key: 'price', header: 'Price', cell: (row) => (
                <span className="font-body-md text-on-surface">{row.price}/mo</span>
              )},
              { key: 'subscribers', header: 'Subscribers', cell: (row) => (
                <span className="font-body-md text-on-surface">{row.subscribers}</span>
              ), align: 'center' },
              { key: 'status', header: 'Status', cell: (row) => (
                <Badge variant="soft" color={row.status === 'active' ? 'success' : 'neutral'}>
                  {row.status}
                </Badge>
              ), align: 'center' },
              { key: 'actions', header: '', cell: () => (
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              ), align: 'right' },
            ]}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
