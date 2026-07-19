"use client";

import { Campaign } from "@/seed/types";
import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/seed/components/ui/button";
import { retryCampaign, resumeCampaign } from "@/app/actions/campaigns-retry-resume";
import { useToast } from "@/forest/hooks/use-toast";
import { CampaignItem } from "./campaign-list/campaign-item";
import { CampaignActions } from "./campaign-list/campaign-actions";
import { useTranslations } from 'next-intl';

const POLL_INTERVAL_MS = 10000; // 10 seconds

interface CampaignListProps {
  initialCampaigns: Campaign[];
}

export function CampaignList({ initialCampaigns }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [retryingCampaigns, setRetryingCampaigns] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const t = useTranslations('dashboard');

  // Poll for campaign updates instead of Supabase Realtime
  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as { campaigns: Campaign[] };
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch {
      // Silently ignore — stale data is acceptable
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchCampaigns, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  const handleRetry = async (campaignId: string) => {
    setRetryingCampaigns(prev => new Set(prev).add(campaignId));

    const result = await retryCampaign(campaignId);

    if (result.success) {
      toast({
        title: t('toasts.retry_started'),
        description: t('toasts.retry_started_desc'),
      });
    } else {
      toast({
        title: t('toasts.retry_failed'),
        description: result.message,
        variant: "destructive",
      });
      setRetryingCampaigns(prev => {
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      });
    }
  };

  const handleResume = async (campaignId: string) => {
    setRetryingCampaigns(prev => new Set(prev).add(campaignId));

    const result = await resumeCampaign(campaignId);

    if (result.success) {
      toast({
        title: t('toasts.resume_success'),
        description: result.message,
      });
    } else {
      toast({
        title: t('toasts.resume_failed'),
        description: result.message,
        variant: "destructive",
      });
      setRetryingCampaigns(prev => {
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      });
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-dashed border-border">
        <h3 className="text-lg font-medium text-foreground">{t('empty_state.title')}</h3>
        <p className="text-muted-foreground mt-1 mb-6">{t('empty_state.description')}</p>
        <Link href="/dashboard/create">
          <Button>{t('empty_state.action')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <CampaignItem campaign={campaign} />
          <CampaignActions
            campaign={campaign}
            isRetrying={retryingCampaigns.has(campaign.id)}
            onRetry={handleRetry}
            onResume={handleResume}
          />
        </div>
      ))}
    </div>
  );
}
