'use client';

import React from 'react';
import { Card, CardHeader, CardContent, Button, Avatar } from '@/components/stitch';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Users, Compass } from 'lucide-react';
import type { AffiliateStats } from '@/forest/dashboard/types';

interface DashboardAffiliatesCardProps {
  affiliates: AffiliateStats[];
}

export function DashboardAffiliatesCard({ affiliates }: DashboardAffiliatesCardProps) {
  const t = useTranslations('stitch.dashboard');

  return (
    <Card padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            {t('topAffiliates.title')}
          </h4>
          {affiliates.length > 0 && (
            <Link href="/affiliates">
              <Button variant="ghost" size="sm" className="text-primary">
                {t('topAffiliates.viewAll')}
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {affiliates.length === 0 ? (
          <div className="py-xl text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-md">
              <Users className="w-6 h-6 opacity-60" />
            </div>
            <p className="font-label-lg text-on-surface font-medium mb-xs">
              {t('topAffiliates.emptyTitle')}
            </p>
            <p className="font-body-sm text-on-surface-variant max-w-xs mb-lg">
              {t('topAffiliates.emptyDesc')}
            </p>
            <Link href="/affiliates/discovery">
              <Button size="sm" variant="outline" iconLeft={<Compass className="w-4 h-4" />}>
                {t('topAffiliates.discover')}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-md">
              {affiliates.map((affiliate) => (
                <div key={affiliate.id} className="flex items-center gap-md">
                  <Avatar
                    src={affiliate.avatar}
                    alt={affiliate.name}
                    initials={affiliate.initials}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface truncate">{affiliate.name}</p>
                    <p className="text-[12px] text-on-surface-variant truncate">{affiliate.stats}</p>
                  </div>
                  <div className="text-emerald-600 font-label-md font-semibold shrink-0">
                    {affiliate.commission}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-lg pt-lg border-t border-outline-variant">
              <Link href="/affiliates">
                <Button variant="outline" fullWidth>
                  {t('topAffiliates.invite')}
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
