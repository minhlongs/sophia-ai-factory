import { Campaign } from "@/types";
import { getStatusIcon } from "./campaign-status";
import { useTranslations } from 'next-intl';
import { useFormatter } from 'next-intl';

interface CampaignItemProps {
  campaign: Campaign;
}

export function CampaignItem({ campaign }: CampaignItemProps) {
  const t = useTranslations('dashboard');
  const format = useFormatter();

  return (
    <div className="flex items-start gap-4">
      <div className="mt-1">
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
            <div className="w-full max-w-[200px] h-2 bg-muted rounded-full overflow-hidden">
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
