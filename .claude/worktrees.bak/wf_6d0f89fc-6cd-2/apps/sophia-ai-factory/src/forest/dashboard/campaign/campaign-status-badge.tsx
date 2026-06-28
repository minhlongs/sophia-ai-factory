'use client';

import { Badge } from '@/seed/components/ui/badge';
import { useTranslations } from 'next-intl';
import { CampaignStatus } from '@/seed/types';
import { CampaignStatusBadgeProps } from './types';

const STATUS_VARIANTS: Record<CampaignStatus, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  draft: 'default',
  queued: 'outline',
  processing_script: 'secondary',
  processing_video: 'secondary',
  completed: 'secondary',
  failed: 'destructive',
};

export function CampaignStatusBadge({
  status,
  className,
  label,
}: CampaignStatusBadgeProps) {
  const t = useTranslations('campaign.status');

  const statusLabel = label ?? t(status);

  return (
    <Badge
      variant={STATUS_VARIANTS[status] ?? 'outline'}
      className={className}
    >
      {statusLabel}
    </Badge>
  );
}

CampaignStatusBadge.displayName = 'CampaignStatusBadge';
