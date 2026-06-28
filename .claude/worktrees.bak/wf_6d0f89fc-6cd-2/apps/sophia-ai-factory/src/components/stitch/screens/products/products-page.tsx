'use client';

import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Badge, Table, Input } from '@/components/stitch';

const mockProducts = [
  { id: '1', name: 'Basic AI Video Pack', type: 'Video Generation', price: '$49', status: 'active', subscribers: 124 },
  { id: '2', name: 'Pro Content Suite', type: 'Full Suite', price: '$99', status: 'active', subscribers: 89 },
  { id: '3', name: 'Enterprise Plan', type: 'Custom', price: 'Custom', status: 'draft', subscribers: 0 },
  { id: '4', name: 'Starter Bundle', type: 'Video Generation', price: '$29', status: 'active', subscribers: 342 },
];

export default function ProductsPage() {
  const [search, setSearch] = useState('');

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
        {mockProducts.map((product) => (
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
            data={mockProducts}
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
