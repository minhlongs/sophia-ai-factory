import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCw, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Campaign } from "@/types";
import { getStatusBadge } from "./campaign-status";

interface CampaignActionsProps {
  campaign: Campaign;
  isRetrying: boolean;
  onRetry: (id: string) => void;
  onResume: (id: string) => void;
}

export function CampaignActions({ campaign, isRetrying, onRetry, onResume }: CampaignActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 md:mt-0">
      {getStatusBadge(campaign.status)}

      <Link href={`/dashboard/campaigns/${campaign.id}`}>
        <Button variant="ghost" size="sm" className="h-8 text-xs sm:text-sm">
          View Details
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
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            Resume
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(campaign.id)}
            disabled={isRetrying}
            className="flex items-center gap-2 h-8 text-xs sm:text-sm"
          >
            {isRetrying ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <RotateCw className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            Retry
          </Button>
        </div>
      )}

      {campaign.video_url && (
        <a
          href={campaign.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-xs sm:text-sm"
        >
          <PlayCircle className="w-4 h-4" />
          Watch Video
        </a>
      )}
    </div>
  );
}
