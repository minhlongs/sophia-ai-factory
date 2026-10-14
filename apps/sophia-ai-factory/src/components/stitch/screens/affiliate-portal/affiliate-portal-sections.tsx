'use client';

import React from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge } from '@/components/stitch';

export const AFFILIATE_PORTAL_STATS = {
  totalEarnings: '$12,450',
  pending: '$3,200',
  clicks: '4,521',
  conversions: '127',
  conversionRate: '2.8%',
};

export const RECENT_REFERRALS = [
  { id: '1', customer: 'Acme Corp', plan: 'Professional', value: '$79', status: 'approved', date: 'Oct 24' },
  { id: '2', customer: 'TechStart Inc', plan: 'Starter', value: '$29', status: 'pending', date: 'Oct 24' },
  { id: '3', customer: 'Design Studio', plan: 'Business', value: '$199', status: 'approved', date: 'Oct 23' },
  { id: '4', customer: 'Dev Agency', plan: 'Professional', value: '$79', status: 'paid', date: 'Oct 23' },
];

export const MARKETING_BANNERS = [
  { id: '1', name: 'Hero Banner', size: '728x90', impressions: '12,451', clicks: '234' },
  { id: '2', name: 'Sidebar', size: '300x250', impressions: '8,234', clicks: '156' },
];

export function AffiliateReferralsAndMaterialsGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
      <Card padding="lg">
        <CardHeader>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Recent Referrals</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-md">
            {RECENT_REFERRALS.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between pb-md border-b border-outline-variant last:border-0 last:pb-0">
                <div>
                  <p className="font-label-md text-on-surface">{ref.customer}</p>
                  <p className="text-sm text-on-surface-variant">{ref.plan} • {ref.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-label-md text-on-surface">{ref.value}</p>
                  <Badge
                    variant="soft"
                    color={
                      ref.status === 'approved' ? 'success' :
                      ref.status === 'paid' ? 'primary' : 'warning'
                    }
                  >
                    {ref.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Marketing Materials</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-md">
            {MARKETING_BANNERS.map((banner) => (
              <div key={banner.id} className="bg-surface rounded-xl p-md flex items-center gap-md">
                <div className="w-16 h-12 bg-secondary-container rounded flex items-center justify-center text-secondary font-mono text-xs">
                  {banner.size}
                </div>
                <div className="flex-1">
                  <p className="font-label-md text-on-surface">{banner.name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {banner.impressions} impressions • {banner.clicks} clicks
                  </p>
                </div>
                <Button variant="ghost" size="sm" iconLeft={<ExternalLink className="w-4 h-4" />}>
                  Get Code
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-lg pt-lg border-t border-outline-variant">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-sm">Commission Structure</p>
            <div className="bg-primary/5 rounded-xl p-md">
              <div className="flex items-center gap-md mb-sm">
                <BarChart3 className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-label-lg text-primary">30% Recurring</p>
                  <p className="text-sm text-on-surface-variant">Earn 30% of all subscription revenue for 24 months</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
