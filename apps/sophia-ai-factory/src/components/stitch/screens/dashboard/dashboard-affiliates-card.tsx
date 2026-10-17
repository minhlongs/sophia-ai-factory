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
    <Card padding="lg" className="bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-foreground dark:text-white tracking-tight">
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
            <div className="w-12 h-12 rounded-full bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.08] flex items-center justify-center text-muted-foreground mb-md">
              <Users className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm text-foreground dark:text-white font-semibold mb-xs">
              {t('topAffiliates.emptyTitle')}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mb-lg">
              {t('topAffiliates.emptyDesc')}
            </p>
            <Link href="/affiliates">
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
                    <p className="text-sm font-semibold text-foreground dark:text-white truncate">{affiliate.name}</p>
                    <p className="text-[12px] font-mono text-muted-foreground truncate">{affiliate.stats}</p>
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-semibold shrink-0">
                    {affiliate.commission}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-lg pt-lg border-t border-border dark:border-white/[0.08]">
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
