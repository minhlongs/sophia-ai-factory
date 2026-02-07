"use client";

import { Campaign } from "@/types";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/supabase/types";
import { Loader2, PlayCircle, AlertCircle, CheckCircle2, Clock, RotateCw, Play } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { retryCampaign, resumeCampaign } from "@/app/actions/campaigns";
import { useToast } from "@/hooks/use-toast";

interface CampaignListProps {
  initialCampaigns: Campaign[];
}

export function CampaignList({ initialCampaigns }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [retryingCampaigns, setRetryingCampaigns] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
          console.log('Realtime update:', payload);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'queued': return <Clock className="w-5 h-5 text-gray-500" />;
      default: return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
     const styles: Record<string, string> = {
        draft: "bg-gray-100 text-gray-800",
        queued: "bg-yellow-100 text-yellow-800",
        processing_script: "bg-blue-100 text-blue-800",
        processing_video: "bg-purple-100 text-purple-800",
        completed: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800"
     };
     return <Badge className={styles[status] || "bg-gray-100"}>{status.replace('_', ' ')}</Badge>;
  };

  const handleRetry = async (campaignId: string) => {
    setRetryingCampaigns(prev => new Set(prev).add(campaignId));

    const result = await retryCampaign(campaignId);

    if (result.success) {
      toast({
        title: "Campaign Retry Started",
        description: "The campaign will restart from the beginning.",
      });
    } else {
      toast({
        title: "Retry Failed",
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
        title: "Campaign Resumed",
        description: result.message,
      });
    } else {
      toast({
        title: "Resume Failed",
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
      <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
        <h3 className="text-lg font-medium text-gray-900">No campaigns yet</h3>
        <p className="text-gray-500 mt-1 mb-6">Create your first automated video campaign.</p>
        <Link href="/dashboard/create">
          <Button>Create Campaign</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <div className="mt-1">
              {getStatusIcon(campaign.status)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{campaign.title || campaign.topic}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{campaign.audience || "General Audience"}</span>
              </div>
              <div className="mt-3">
                 {/* Progress Bar */}
                 {(campaign.status.includes('processing') || campaign.status === 'queued') && (
                    <div className="w-full max-w-[200px] h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${campaign.progress || 0}%` }}
                        />
                    </div>
                 )}
                 {campaign.error_message && (
                    <p className="text-sm text-red-600 mt-1">{campaign.error_message}</p>
                 )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {getStatusBadge(campaign.status)}

            <Link href={`/dashboard/campaigns/${campaign.id}`}>
              <Button variant="ghost" size="sm">
                View Details
              </Button>
            </Link>

            {campaign.status === 'failed' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResume(campaign.id)}
                  disabled={retryingCampaigns.has(campaign.id)}
                  className="flex items-center gap-2"
                >
                  {retryingCampaigns.has(campaign.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Resume
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(campaign.id)}
                  disabled={retryingCampaigns.has(campaign.id)}
                  className="flex items-center gap-2"
                >
                  {retryingCampaigns.has(campaign.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCw className="w-4 h-4" />
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
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                <PlayCircle className="w-4 h-4" />
                Watch Video
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
