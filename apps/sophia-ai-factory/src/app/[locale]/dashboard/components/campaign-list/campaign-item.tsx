import { Campaign } from "@/seed/types";
import { getStatusIcon } from "./campaign-status";
import { useTranslations } from 'next-intl';
import { useFormatter } from 'next-intl';

interface CampaignItemProps {
  campaign: Campaign;
}

const VALID_STATUSES = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'] as const;
type StatusKey = typeof VALID_STATUSES[number];

export function CampaignItem({ campaign }: CampaignItemProps) {
  const t = useTranslations('dashboard');
  const tStatus = useTranslations('campaign.status');
  const format = useFormatter();

  const statusLabel = VALID_STATUSES.includes(campaign.status as StatusKey)
    ? tStatus(campaign.status as StatusKey)
    : campaign.status.replace(/_/g, ' ');

  return (
    <div className="flex items-start gap-4">
      <div className="mt-1" role="img" aria-label={statusLabel}>
        {getStatusIcon(campaign.status)}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{campaign.title || campaign.topic}</h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <span>{format.dateTime(new Date(campaign.created_at), {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
          })}</span>
          <span>•</span>
          <span>{campaign.audience || t('general_audience')}</span>
        </div>
        <div className="mt-3">
          {/* Progress Bar */}
          {(campaign.status.includes('processing') || campaign.status === 'queued') && (
            <div className="w-full max-w-[200px] h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-label={`Tiến độ: ${campaign.progress || 0}%`} aria-valuenow={campaign.progress || 0} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${campaign.progress || 0}%` }}
              />
            </div>
          )}
          {campaign.error_message && (
            <p className="text-sm text-destructive mt-1">{campaign.error_message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
