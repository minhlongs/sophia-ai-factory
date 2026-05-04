import { Badge } from "@/seed/components/ui/badge";
import { Button } from "@/seed/components/ui/button";
import { ArrowLeft, Calendar, Users, CheckCircle2, Clock, AlertCircle, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { Campaign } from "@/seed/types";
import type { getFormatter } from "next-intl/server";

type IntlFormat = Awaited<ReturnType<typeof getFormatter>>;

interface CampaignHeaderProps {
  campaign: Campaign;
  t: (key: string) => string;
  tStatus: (key: string) => string;
  format: IntlFormat;
}

export function CampaignHeader({ campaign, t, tStatus, format }: CampaignHeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case 'failed': return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case 'queued': return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case 'draft': return "bg-muted text-muted-foreground border-border";
      default: return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case 'failed': return <AlertCircle className="w-4 h-4 mr-1" />;
      case 'queued': return <Clock className="w-4 h-4 mr-1" />;
      case 'draft': return <FileText className="w-4 h-4 mr-1" />;
      default: return <Loader2 className="w-4 h-4 mr-1 motion-safe:animate-spin" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const validStatuses = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'] as const;
    type StatusKey = typeof validStatuses[number];
    if (validStatuses.includes(status as StatusKey)) {
        return tStatus(status as StatusKey);
    }
    return status.replace(/_/g, " ");
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard/campaigns"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {t('back')}
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{campaign.title || t('untitled')}</h1>
            <Badge variant="outline" className={`${getStatusColor(campaign.status)} capitalize flex items-center`}>
              {getStatusIcon(campaign.status)}
              {getStatusLabel(campaign.status)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1.5" />
              {t('created')} {format.dateTime(new Date(campaign.created_at), { dateStyle: 'medium' })}
            </div>
            {campaign.audience && (
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1.5" />
                {campaign.audience}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === 'failed' && (
             <Button variant="outline" className="border-destructive/20 text-destructive hover:bg-destructive/10">
               {t('retry')}
             </Button>
          )}
        </div>
      </div>
    </div>
  );
}
