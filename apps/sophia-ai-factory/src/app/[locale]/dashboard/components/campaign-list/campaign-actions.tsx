import { Button } from "@/seed/components/ui/button";
import { Loader2, Play, RotateCw, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Campaign } from "@/seed/types";
import { getStatusBadge } from "./campaign-status";
import { useTranslations } from 'next-intl';

interface CampaignActionsProps {
  campaign: Campaign;
  isRetrying: boolean;
  onRetry: (id: string) => void;
  onResume: (id: string) => void;
}

export function CampaignActions({ campaign, isRetrying, onRetry, onResume }: CampaignActionsProps) {
  const t = useTranslations('dashboard.buttons');
  const tStatus = useTranslations('campaign.status');

  // Translate status for badge
  const statusKeys = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'] as const;
  type StatusKey = typeof statusKeys[number];
  const statusLabel = statusKeys.includes(campaign.status as StatusKey)
    ? tStatus(campaign.status as StatusKey)
    : campaign.status.replace(/_/g, ' ');

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 md:mt-0">
      {getStatusBadge(campaign.status, statusLabel)}

      <Link href={`/dashboard/campaigns/${campaign.id}`}>
        <Button variant="ghost" size="sm" className="h-8 text-xs sm:text-sm">
          {t('view_details')}
        </Button>
      </Link>

      {campaign.status === 'failed' && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResume(campaign.id)}
            disabled={isRetrying}
            className="flex items-center gap-2 h-8 text-xs sm:text-sm"
          >
            {isRetrying ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 motion-safe:animate-spin" />
            ) : (
              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            {t('resume')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(campaign.id)}
            disabled={isRetrying}
            className="flex items-center gap-2 h-8 text-xs sm:text-sm"
          >
            {isRetrying ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 motion-safe:animate-spin" />
            ) : (
              <RotateCw className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            {t('retry')}
          </Button>
        </div>
      )}

      {campaign.video_url && (
        <a
          href={campaign.video_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t('watch_video')}: ${campaign.title || campaign.topic}`}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-xs sm:text-sm"
        >
          <PlayCircle className="w-4 h-4" />
          {t('watch_video')}
        </a>
      )}
    </div>
  );
}
