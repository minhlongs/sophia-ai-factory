import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { VideoPreview } from "@/components/video-preview";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Users, FileText, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Campaign } from "@/types";
import { createClient } from "@supabase/supabase-js";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  let campaign: Campaign | null = null;

  if (session?.user) {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();
    campaign = data ? (data as unknown as Campaign) : null;
  } else if (process.env.NODE_ENV === 'development') {
    // Dev fallback
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();
    campaign = data ? (data as unknown as Campaign) : null;
  } else {
    redirect("/login");
  }

  if (!campaign) {
    notFound();
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return "bg-green-100 text-green-800 border-green-200";
      case 'failed': return "bg-red-100 text-red-800 border-red-200";
      case 'queued': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'draft': return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 mr-1" />;
      case 'failed': return <AlertCircle className="w-4 h-4 mr-1" />;
      case 'queued': return <Clock className="w-4 h-4 mr-1" />;
      case 'draft': return <FileText className="w-4 h-4 mr-1" />;
      default: return <Loader2 className="w-4 h-4 mr-1 animate-spin" />;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Campaigns
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{campaign.title || "Untitled Campaign"}</h1>
              <Badge variant="outline" className={`${getStatusColor(campaign.status)} capitalize flex items-center`}>
                {getStatusIcon(campaign.status)}
                {campaign.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                Created {new Date(campaign.created_at).toLocaleDateString()}
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
               <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                 Retry Generation
               </Button>
            )}
            {/* Additional actions like Edit, Delete could go here */}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Video Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1">
             <VideoPreview
               videoUrl={campaign.video_url}
               thumbnailUrl={campaign.thumbnail_url}
               status={campaign.status}
               progress={campaign.progress || 0}
               errorMessage={campaign.error_message}
               campaignId={campaign.id}
             />
          </div>

          {/* Script Content (if available) */}
          {campaign.script_content && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Generated Script
              </h3>
import { ScriptOutput } from "@/lib/services/types";

// ... (other imports)

// Inside the component return JSX
              <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg">
                {/*
                   We assume script_content structure here.
                   Adjust based on actual JSON structure stored.
                */}
                {(campaign.script_content as unknown as ScriptOutput)?.scenes ? (
                   <div className="space-y-4">
                     {(campaign.script_content as unknown as ScriptOutput).scenes.map((scene, idx: number) => (
                       <div key={idx} className="border-l-2 border-blue-200 pl-4">
                         <p className="font-medium text-gray-900 text-xs uppercase mb-1">Scene {idx + 1}</p>
                         <p className="text-gray-700 mb-2">{scene.narration}</p>
                         <p className="text-xs text-gray-500 italic">Visual: {scene.visual_description}</p>
                       </div>
                     ))}
                   </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(campaign.script_content, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Campaign Details</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Topic</label>
                <p className="text-sm text-gray-900 font-medium">{campaign.topic || "N/A"}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Target Audience</label>
                <p className="text-sm text-gray-900">{campaign.audience || "General"}</p>
              </div>

              {campaign.template_id && (
                <div>
                   <label className="text-xs font-medium text-gray-500 block mb-1">Template</label>
                   <Badge variant="secondary" className="font-normal">
                     {campaign.template_id}
                   </Badge>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium capitalize">{campaign.status.replace(/_/g, " ")}</span>
                </div>
                {campaign.progress !== null && campaign.progress < 100 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Progress</span>
                      <span>{campaign.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${campaign.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tech/Debug Info (Only visible in dev or for admins) */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
             <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">System Info</h4>
             <div className="space-y-2 text-xs text-gray-600 font-mono">
               <div className="flex justify-between">
                 <span>ID:</span>
                 <span className="truncate ml-2" title={campaign.id}>{campaign.id.substring(0, 8)}...</span>
               </div>
               <div className="flex justify-between">
                 <span>Updated:</span>
                 <span>{new Date(campaign.updated_at).toLocaleTimeString()}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
