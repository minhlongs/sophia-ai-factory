'use client';

import React, { useState } from 'react';
import { Search, Mail, Phone, MoreVertical, Trash2 } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Badge, Table, Input, Avatar } from '@/components/stitch';

const mockSubscribers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@acme.com',
    plan: 'Professional',
    status: 'active',
    joined: 'Oct 20, 2023',
    avatar: null,
  },
  {
    id: '2',
    name: 'Maria Smith',
    email: 'maria@techco.io',
    plan: 'Enterprise',
    status: 'active',
    joined: 'Oct 18, 2023',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWSzEsLXtlCtQl1JnTEm3U6SpevfsPDoGf5AETFg_kJqGKabfczl1Ki8Pei4SD7ANALXRbw-6UgDLHRQvpjVYic1Ruql8gfEgqHV7KL9DYJpKbBvxdLiieBRVrxqcIhnJRHVIMkDmD7VqEWT951o6ciCz9VwMV9svjRL5bfsJq42_CjIASiXbLP-NtOSNxovB_IMnangbB04G2r8QWfnKrM-6qMJpncKFAA5EbcHl4bRR9dELLiRWTMJuqz4dlxMu-_nhvZw7tcEY',
  },
  {
    id: '3',
    name: 'Robert King',
    email: 'robert@startup.io',
    plan: 'Starter',
    status: 'inactive',
    joined: 'Oct 15, 2023',
    avatar: null,
  },
  {
    id: '4',
    name: 'Linda Blair',
    email: 'linda@corp.net',
    plan: 'Professional',
    status: 'active',
    joined: 'Oct 10, 2023',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGZr4YpKoijz4WYuZNO0522FfJKdFQWYUoIi-kLbPXfLiEjARMh_4cwWq1gNaK24lKlRB08a84jMpMruzQm4JWikamNkEnVs3yw7WgsXn6TFttfQeRtrYVUVB09h5vwWu60oqZOI3ca4MwX4WR0_41LMDab7-Ds8kGqUJdZXOOdJ455C1Fk-EA56UeZa5y2JDD7nLna7spVR-cvGTfy8zdmeRg1jvioNQRjX0sP93-ObJLQxdGTaH9O02Y_kcsLwMdykdp9hRR0eg',
  },
];

export default function SubscribersPage() {
  const [search, setSearch] = useState('');

  return (
    <DashboardLayout
      title="Subscribers"
      subtitle="Manage your subscribers and their subscriptions"
      actions={
        <Button variant="outline" iconLeft={<MoreVertical className="w-4 h-4" />}>
          Export
        </Button>
      }
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Total</p>
          <p className="font-headline-md text-headline-md text-on-surface">1,240</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Active</p>
          <p className="font-headline-md text-headline-md text-emerald-600">1,187</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Canceled</p>
          <p className="font-headline-md text-headline-md text-on-surface-variant">53</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">MRR</p>
          <p className="font-headline-md text-headline-md text-primary">$98,650</p>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-xl" padding="md">
        <div className="flex items-center gap-md">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <Input
              placeholder="Search subscribers by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-sm">
            <Button variant="outline" size="md">
              <Mail className="w-4 h-4 mr-sm" />
              Email All
            </Button>
            <Button variant="outline" size="md">
              <Phone className="w-4 h-4 mr-sm" />
              SMS
            </Button>
          </div>
        </div>
      </Card>

      {/* Subscribers Table */}
      <Card padding="none">
        <Table
          data={mockSubscribers}
          columns={[
            { key: 'subscriber', header: 'Subscriber', cell: (row) => (
              <div className="flex items-center gap-md">
                <Avatar src={row.avatar} alt={row.name} initials={row.name} size="md" />
                <div>
                  <p className="font-label-md text-on-surface">{row.name}</p>
                  <p className="text-[12px] text-on-surface-variant">{row.email}</p>
                </div>
              </div>
            ) },
            { key: 'plan', header: 'Plan', cell: (row) => (
              <Badge variant="soft" color={row.plan === 'Enterprise' ? 'primary' : 'secondary'}>
                {row.plan}
              </Badge>
            ), align: 'center' },
            { key: 'status', header: 'Status', cell: (row) => (
              <Badge variant="soft" color={row.status === 'active' ? 'success' : 'neutral'}>
                {row.status}
              </Badge>
            ), align: 'center' },
            { key: 'joined', header: 'Joined', cell: (row) => (
              <span className="font-body-sm text-on-surface-variant">{row.joined}</span>
            ), align: 'center' },
            { key: 'actions', header: '', cell: () => (
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            ), align: 'right' },
          ]}
          getRowId={(row) => row.id}
        />
      </Card>
    </DashboardLayout>
  );
}
