'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/stitch';

export function InvalidTokenView() {
  const t = useTranslations('stitch.affiliates.join');

  return (
    <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-destructive/30 text-center shadow-2xl space-y-5">
      <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">
          {t('invalidTokenTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('invalidTokenDescription')}
        </p>
      </div>
      <div className="pt-2">
        <Link href="/">
          <Button variant="outline" fullWidth>
            {t('backToHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
