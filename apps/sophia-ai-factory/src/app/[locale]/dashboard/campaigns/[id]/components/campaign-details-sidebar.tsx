import { Badge } from "@/seed/components/ui/badge";
import { Campaign } from "@/seed/types";
import type { getFormatter } from "next-intl/server";

type IntlFormat = Awaited<ReturnType<typeof getFormatter>>;

interface CampaignDetailsSidebarProps {
  campaign: Campaign;
  t: (key: string) => string;
  tStatus: (key: string) => string;
  format: IntlFormat;
}

export function CampaignDetailsSidebar({ campaign, t, tStatus, format }: CampaignDetailsSidebarProps) {
  const getStatusLabel = (status: string) => {
    const validStatuses = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'] as const;
    type StatusKey = typeof validStatuses[number];
    if (validStatuses.includes(status as StatusKey)) {
        return tStatus(status as StatusKey);
    }
    return status.replace(/_/g, " ");
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">{t('title')}</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{t('topic')}</label>
            <p className="text-sm text-foreground font-medium">{campaign.topic || t('na')}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{t('audience')}</label>
            <p className="text-sm text-foreground">{campaign.audience || t('general')}</p>
          </div>

          {campaign.template_id && (
            <div>
               <label className="text-xs font-medium text-muted-foreground block mb-1">{t('template')}</label>
               <Badge variant="secondary" className="font-normal">
                 {campaign.template_id}
               </Badge>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t('status')}</span>
              <span className="font-medium capitalize text-foreground">{getStatusLabel(campaign.status)}</span>
            </div>
            {campaign.progress !== null && campaign.progress < 100 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('progress')}</span>
                  <span>{campaign.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${campaign.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tech/Debug Info */}
      <div className="bg-muted/50 rounded-xl border border-border p-4">
         <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t('system_info')}</h4>
         <div className="space-y-2 text-xs text-muted-foreground font-mono">
           <div className="flex justify-between">
             <span>{t('id')}:</span>
             <span className="truncate ml-2" title={campaign.id}>{campaign.id.substring(0, 8)}...</span>
           </div>
           <div className="flex justify-between">
             <span>{t('updated')}:</span>
             <span>{format.dateTime(new Date(campaign.updated_at), { dateStyle: 'short', timeStyle: 'short' })}</span>
           </div>
         </div>
      </div>
    </div>
  );
}
