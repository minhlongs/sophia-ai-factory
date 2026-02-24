"use client";

import { Campaign } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/supabase/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { retryCampaign, resumeCampaign } from "@/app/actions/campaigns";
import { useToast } from "@/hooks/use-toast";
import { CampaignItem } from "./campaign-list/campaign-item";
import { CampaignActions } from "./campaign-list/campaign-actions";
import { useTranslations } from 'next-intl';

interface CampaignListProps {
  initialCampaigns: Campaign[];
}

export function CampaignList({ initialCampaigns }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [retryingCampaigns, setRetryingCampaigns] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const t = useTranslations('dashboard');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const supabase = useMemo(
    () => createBrowserClient<Database>(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey]
  );

  useEffect(() => {
    // Subscribe to realtime changes
    const channel = supabase
      .channel('realtime-campaigns')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        (payload: RealtimePostgresChangesPayload<Campaign>) => {
          if (payload.eventType === 'INSERT') {
             setCampaigns((prev) => [payload.new as Campaign, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
             setCampaigns((prev) =>
               prev.map((c) => c.id === payload.new.id ? { ...c, ...(payload.new as Campaign) } : c)
             );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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
