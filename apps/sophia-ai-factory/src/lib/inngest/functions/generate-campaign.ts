import { inngest } from "@/lib/inngest/client";
import { ServiceFactory } from "@/lib/services/factory";
import { startVideoGeneration, checkVideoGenerationStatus } from "@/lib/ai/video-generator";
import { sendTelegramMessage } from "@/lib/telegram/telegram-client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CampaignStatus } from "@/types";
import { Database, Json } from "@/lib/supabase/types";
import { OpenClawGateway } from "@/lib/gateway/openclaw-gateway";
import { SmartResumeEngine } from "@/lib/gateway/smart-resume-engine";
import { YouTubeChannelAdapter } from "@/lib/gateway/adapters/youtube-channel-adapter";
import { TikTokChannelAdapter } from "@/lib/gateway/adapters/tiktok-channel-adapter";
import { TelegramNotificationAdapter } from "@/lib/gateway/adapters/telegram-notification-adapter";

// Lazy init Supabase Admin client for build compatibility
let _supabase: SupabaseClient<Database> | null = null;

function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables not configured');
    }
    _supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

// Singleton instances for gateway and resume engine
const resumeEngine = new SmartResumeEngine();

function createGateway(): OpenClawGateway {
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 });
  gateway.registerChannel({
    id: "youtube",
    name: "YouTube",
    adapter: new YouTubeChannelAdapter(),
    enabled: true,
    rateLimitPerHour: 6,
  });
  gateway.registerChannel({
    id: "tiktok",
    name: "TikTok",
    adapter: new TikTokChannelAdapter(),
    enabled: true,
    rateLimitPerHour: 10,
  });
  gateway.registerChannel({
    id: "telegram",
    name: "Telegram Notifications",
    adapter: new TelegramNotificationAdapter(),
    enabled: true,
    rateLimitPerHour: 60,
  });
  return gateway;
}

export const generateCampaign = inngest.createFunction(
  {
    id: "generate-campaign",
    retries: 3
  },
  { event: "campaign.created" },
  async ({ event, step }) => {
    const { campaignId, userId, topic, audience, tier, resume, resumeFrom } = event.data;

    // Helper to update status
    const updateStatus = async (status: CampaignStatus, progress: number, data?: Record<string, unknown>) => {
      const updatePayload: Database['public']['Tables']['campaigns']['Update'] = {
        status,
        progress,
        updated_at: new Date().toISOString(),
      };

      if (data?.script_content) updatePayload.script_content = data.script_content as Json;
      if (data?.audio_url) updatePayload.audio_url = data.audio_url as string;
      if (data?.video_url) updatePayload.video_url = data.video_url as string;
      if (data?.thumbnail_url) updatePayload.thumbnail_url = data.thumbnail_url as string;
      if (data?.error_message) updatePayload.error_message = data.error_message as string;

      const { error } = await getSupabase()
        .from("campaigns")
        // @ts-expect-error Database type missing Relationships for Supabase generic inference
        .update(updatePayload)
        .eq("id", campaignId);

      if (error) throw new Error(`Failed to update status: ${error.message}`);
    };

    // Helper to send notification
    const notifyUser = async (message: string) => {
      // 1. Fetch user's telegram chat ID and settings
      const { data, error } = await getSupabase()
        .from("user_profiles")
        .select("telegram_chat_id, settings")
        .eq("user_id", userId)
        .single();

      // Cast to expected type to avoid inference issues
      const profile = data as {
        telegram_chat_id: string | null;
        settings: {
          notifications?: {
            telegram?: { enabled?: boolean };
          };
        } | null;
      } | null;

      if (error || !profile || !profile.telegram_chat_id) {
        console.log(`No telegram chat ID found for user ${userId}`);
        return;
      }

      // Check if telegram notifications are enabled
      // Default to false if settings or notification settings are missing
      const telegramEnabled = profile.settings?.notifications?.telegram?.enabled === true;

      if (!telegramEnabled) {
        console.log(`Telegram notifications disabled for user ${userId}`);
        return;
      }

      // 2. Send message
      await sendTelegramMessage(profile.telegram_chat_id, message);
    };

    // Step 0: Notify Start
    await step.run("notify-start", async () => {
      if (!resume) {
        await notifyUser(`🎬 **Sophia AI**: Starting campaign generation for "${topic}"...`);
      } else {
        await notifyUser(`🔄 **Sophia AI**: Resuming campaign for "${topic}" from ${resumeFrom} step...`);
      }
    });

    // Step 1: Generate Script (skip if resuming from tts, video or finalize)
    const script = await step.run("generate-script", async () => {
      if (resume && (resumeFrom === "tts" || resumeFrom === "video" || resumeFrom === "finalize")) {
        // Fetch existing script from database
        const { data: campaign } = await getSupabase()
          .from("campaigns")
          .select("script_content")
          .eq("id", campaignId)
          .single();

        // Type assertion for campaign data
        type CampaignWithScript = { script_content: Record<string, unknown> | null };
        const typedCampaign = campaign as CampaignWithScript | null;

        if (!typedCampaign?.script_content) {
          throw new Error("Cannot resume: script content not found");
        }

        return typedCampaign.script_content;
      }

      // Generate new script
      await updateStatus("processing_script", 10);
      const scriptService = ServiceFactory.getScriptService();
      const result = await scriptService.generateScript({ topic, audience, tier });
      await updateStatus("processing_script", 35, { script_content: result });
      await resumeEngine.checkpoint(campaignId, "generate-script");
      return result;
    });

    // Step 2: Generate Voiceover/TTS (skip if resuming from video or finalize)
    await step.run("generate-voiceover", async () => {
      if (resume && (resumeFrom === "video" || resumeFrom === "finalize")) {
        // Fetch existing audio from database
        const { data: campaign } = await getSupabase()
          .from("campaigns")
          .select("audio_url")
          .eq("id", campaignId)
          .single();

        type CampaignWithAudio = { audio_url: string | null };
        const typedCampaign = campaign as CampaignWithAudio | null;

        if (!typedCampaign?.audio_url) {
          throw new Error("Cannot resume: audio URL not found");
        }

        return typedCampaign.audio_url;
      }

      // Extract narration from script
      const scriptData = script as { scenes: Array<{ narration: string }> };
      const fullNarration = scriptData.scenes.map(s => s.narration).join(' ');

      // Generate voiceover
      await updateStatus("processing_script", 45);
      if (!resume) {
        await notifyUser(`📝 Script ready! Now generating voiceover...`);
      }

      const voiceService = ServiceFactory.getVoiceService();
      const voiceoverResult = await voiceService.generateVoiceover({
        text: fullNarration,
        tier
      });

      await updateStatus("processing_script", 60, { audio_url: voiceoverResult.audio_url });
      await resumeEngine.checkpoint(campaignId, "generate-voiceover");
      return voiceoverResult.audio_url;
    });

    // Step 3: Start Video Generation
    const videoJobId = await step.run("start-video-generation", async () => {
      if (resume && resumeFrom === "finalize") {
        return null; // Skip if already finalized
      }

      await updateStatus("processing_video", 70);
      if (!resume) {
        await notifyUser(`🎤 Voiceover ready! Now rendering video... (This may take a few minutes)`);
      }

      return await startVideoGeneration({ script, tier });
    });

    // Step 4: Poll Video Status
    const videoAssets = await step.run("poll-video-status", async () => {
      if (resume && resumeFrom === "finalize") {
         // Fetch existing video from database
         const { data: campaign } = await getSupabase()
           .from("campaigns")
           .select("video_url, thumbnail_url")
           .eq("id", campaignId)
           .single();

         type CampaignWithVideo = { video_url: string | null; thumbnail_url: string | null };
         const typedCampaign = campaign as CampaignWithVideo | null;

         if (!typedCampaign?.video_url) {
           throw new Error("Cannot resume: video URL not found");
         }

         return {
           video_url: typedCampaign.video_url,
           thumbnail_url: typedCampaign.thumbnail_url || ""
         };
      }

      if (!videoJobId) throw new Error("Video Job ID missing");

      // Polling loop with sleep
      let attempts = 0;
      const maxAttempts = 60; // 5 mins total with 5s intervals

      while (attempts < maxAttempts) {
        const status = await checkVideoGenerationStatus(videoJobId, tier);

        if (status.status === 'completed' && status.output) {
           return status.output;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Video generation failed');
        }

        // Wait 5 seconds before next check
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
      }

      throw new Error("Video generation timed out");
    });

    // Step 4b: Smart Resume checkpoint after video ready
    await step.run("checkpoint-video-ready", async () => {
      await resumeEngine.checkpoint(campaignId, "poll-video-status", {
        video_url: videoAssets.video_url,
        thumbnail_url: videoAssets.thumbnail_url,
      });
    });

    // Step 5: Distribute via OpenClaw Gateway
    const distributionResult = await step.run("distribute-channels", async () => {
      const gateway = createGateway();

      const campaignTitle = topic || `Campaign ${campaignId}`;
      const result = await gateway.distribute({
        campaignId,
        videoUrl: videoAssets.video_url,
        thumbnailUrl: videoAssets.thumbnail_url || undefined,
        title: campaignTitle,
        description: `AI-generated video content for ${audience || "general audience"}`,
        tags: ["sophia-ai", "auto-generated", tier.toLowerCase()],
      });

      // Self-heal failed channels
      if (!result.allSucceeded) {
        const healed = await gateway.selfHeal(
          {
            campaignId,
            videoUrl: videoAssets.video_url,
            thumbnailUrl: videoAssets.thumbnail_url || undefined,
            title: campaignTitle,
            description: `AI-generated video for ${audience || "general audience"}`,
            tags: ["sophia-ai", "auto-generated", tier.toLowerCase()],
          },
          result,
        );
        await resumeEngine.checkpoint(campaignId, "distribute-channels", {
          allSucceeded: healed.allSucceeded,
          channelCount: healed.results.length,
        });
        return healed;
      }

      await resumeEngine.checkpoint(campaignId, "distribute-channels", {
        allSucceeded: result.allSucceeded,
        channelCount: result.results.length,
      });
      return result;
    });

    // Step 6: Finalize
    await step.run("finalize-campaign", async () => {
      await updateStatus("completed", 100, {
        video_url: videoAssets.video_url,
        thumbnail_url: videoAssets.thumbnail_url
      });

      const distributedChannels = distributionResult.results
        .filter((r) => r.success)
        .map((r) => r.channelId)
        .join(", ");

      const statusLine = distributionResult.allSucceeded
        ? `Published to: ${distributedChannels}`
        : `Partially published (${distributedChannels}). Some channels failed.`;

      await notifyUser(
        `✅ **Campaign Ready!**\nYour video for "${topic}" is ready.\n${statusLine}\n[Watch Video](${videoAssets.video_url})`
      );

      await resumeEngine.checkpoint(campaignId, "finalize-campaign");
      await resumeEngine.clearCheckpoints(campaignId);
    });

    return { success: true, campaignId };
  }
);
