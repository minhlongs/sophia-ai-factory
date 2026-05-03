'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/seed/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/seed/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/seed/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { DateRange } from 'react-day-picker';

export interface ExportButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onExport?: (format: 'csv' | 'png') => Promise<void>;
  dateRange?: DateRange;
  className?: string;
  upgradeHint?: string;
}

export function ExportButton({
  disabled = false,
  loading = false,
  onExport,
  dateRange,
  className,
  upgradeHint,
}: ExportButtonProps) {
  const t = useTranslations('dashboard.analytics');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'png') => {
    if (disabled || loading) return;

    setIsExporting(true);
    try {
      await onExport?.(format);
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || loading || isExporting;

  const buttonContent = (
    <Button
      variant="outline"
      size="sm"
      disabled={isDisabled}
      className={cn(className)}
    >
      {loading || isExporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      {t('export_csv') || 'Export'}
    </Button>
  );

  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[200px]">
              {upgradeHint || t('export_disabled_hint') || 'Upgrade to PREMIUM for exports'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {buttonContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('png')}>
          PNG (Chart)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
