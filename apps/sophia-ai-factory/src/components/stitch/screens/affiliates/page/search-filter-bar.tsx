'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Mail } from 'lucide-react';
import { Button } from '@/components/stitch';

interface SearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function SearchFilterBar({ search, onSearchChange }: SearchFilterBarProps) {
  const t = useTranslations('stitch.affiliates');

  return (
    <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-border dark:border-white/[0.08]">
      <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60 transition-all font-sans"
        />
      </div>
      <Button variant="outline" size="md" iconLeft={<Mail className="w-4 h-4" />} className="w-full sm:w-auto">
        {t('emailAll')}
      </Button>
    </div>
  );
}
