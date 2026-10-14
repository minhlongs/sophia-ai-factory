'use client';
// i18n-namespace: dashboard.billing.changeTier

import React from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface MasterBannerProps {
  t: (key: string) => string;
}

export function MasterBanner({ t }: MasterBannerProps) {
  return (
    <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30">
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="font-semibold text-sm">{t('master_title')}</p>
          <p className="text-xs text-muted-foreground">{t('master_hint')}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/pricing">
            {t('master_cta')}{' '}
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
