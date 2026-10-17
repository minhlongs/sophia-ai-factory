'use client';

import React from 'react';
import { MoreVertical, Edit, Eye } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Table } from '@/components/stitch';
import type { ProductItem } from './products-page';

export interface ProductsCatalogProps {
  products: ProductItem[];
}

export function ProductsGrid({ products }: ProductsCatalogProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg mb-xl">
      {products.map((product) => (
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
  );
}

export function ProductsTableSection({ products }: ProductsCatalogProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">All Products</h4>
      <Table
        data={products}
        emptyMessage="No products configured yet. Click 'Add Product' to create a new package."
        columns={[
          {
            key: 'name',
            header: 'Product',
            cell: (row) => (
              <div>
                <p className="font-label-md text-on-surface font-medium">{row.name}</p>
                <p className="text-[12px] text-on-surface-variant">{row.type}</p>
              </div>
            ),
          },
          {
            key: 'price',
            header: 'Price',
            cell: (row) => (
              <span className="font-body-md text-on-surface">{row.price}/mo</span>
            ),
          },
          {
            key: 'subscribers',
            header: 'Subscribers',
            cell: (row) => (
              <span className="font-body-md text-on-surface">{row.subscribers}</span>
            ),
            align: 'center',
          },
          {
            key: 'status',
            header: 'Status',
            cell: (row) => (
              <Badge variant="soft" color={row.status === 'active' ? 'success' : 'neutral'}>
                {row.status}
              </Badge>
            ),
            align: 'center',
          },
          {
            key: 'actions',
            header: '',
            cell: () => (
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            ),
            align: 'right',
          },
        ]}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
