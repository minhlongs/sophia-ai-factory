'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

interface CampaignsPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCampaigns: number;
  startItem: number;
  endItem: number;
  paginationButtons: (number | 'ellipsis')[];
  onPageChange: (page: number) => void;
}

export function CampaignsPagination({
  currentPage,
  totalPages,
  totalCampaigns,
  startItem,
  endItem,
  paginationButtons,
  onPageChange,
}: CampaignsPaginationProps) {
  const t = useTranslations('stitch.campaigns');

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant">
      <p className="text-xs text-muted-foreground">
        {t('pagination.showing', { start: startItem, end: endItem, total: totalCampaigns })}
      </p>
      <nav className="flex items-center gap-1" aria-label={t('aria.pagination')}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-variant disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          aria-label={t('aria.previousPage')}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>

        {paginationButtons.map((btn, idx) =>
          btn === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground" aria-hidden="true">
              ...
            </span>
          ) : (
            <button
              key={btn}
              type="button"
              onClick={() => onPageChange(btn)}
              aria-current={btn === currentPage ? 'page' : undefined}
              aria-label={t('aria.page', { page: btn })}
              className={cn(
                'w-10 h-10 rounded-lg font-bold text-sm transition-all',
                btn === currentPage
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-variant'
              )}
            >
              {btn}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-variant disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          aria-label={t('aria.nextPage')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  );
}
