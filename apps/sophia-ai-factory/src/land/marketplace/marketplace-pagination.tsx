'use client';

/**
 * Pagination Controls for Marketplace Discovery
 *
 * Layer: land (pure UI component)
 *
 * @module land/marketplace/marketplace-pagination
 */

import React, { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface MarketplacePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function MarketplacePagination({
  page,
  pageSize,
  total,
  totalPages,
}: MarketplacePaginationProps) {
  const t = useTranslations('blueprintMarketplace');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  if (totalPages <= 1) return null;

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-muted-foreground">
      <p>
        {t('pagination.showingResults', { from, to, total })}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-medium hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('pagination.prev')}
        </button>

        <span className="px-2 font-semibold text-foreground">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-medium hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition"
        >
          {t('pagination.next')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
