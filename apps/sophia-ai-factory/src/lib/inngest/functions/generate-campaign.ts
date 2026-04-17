import { inngest } from "@/lib/inngest/client";
import { ServiceFactory } from "@/lib/services/factory";
import { startVideoGeneration, checkVideoGenerationStatus } from "@/lib/ai/video-generator";
import { sendMessage as sendTelegramMessage } from "@/lib/telegram/handlers/utils";
import { getD1Client } from "@/lib/db/client";
import { CampaignStatus } from "@/types";
import { OpenClawGateway } from "@/lib/gateway/openclaw-gateway";
import { SmartResumeEngine } from "@/lib/gateway/smart-resume-engine";
import { YouTubeChannelAdapter } from "@/lib/gateway/adapters/youtube-channel-adapter";
import { TikTokChannelAdapter } from "@/lib/gateway/adapters/tiktok-channel-adapter";
import { TelegramNotificationAdapter } from "@/lib/gateway/adapters/telegram-notification-adapter";
import { logger } from "@/lib/utils/logger-utility";

// Singleton resume engine
const resumeEngine = new SmartResumeEngine();

function createGateway(): OpenClawGateway {
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 });
  gateway.registerChannel({ id: "youtube",  name: "YouTube",               adapter: new YouTubeChannelAdapter(),          enabled: true, rateLimitPerHour: 6  });
  gateway.registerChannel({ id: "tiktok",   name: "TikTok",                adapter: new TikTokChannelAdapter(),           enabled: true, rateLimitPerHour: 10 });
  gateway.registerChannel({ id: "telegram", name: "Telegram Notifications", adapter: new TelegramNotificationAdapter(),    enabled: true, rateLimitPerHour: 60 });
  return gateway;
}

export const generateCampaign = inngest.createFunction(
  { id: "generate-campaign", retries: 3 },
  { event: "campaign.created" },
  async ({ event, step }) => {
    const { campaignId, userId, topic, audience, tier, resume, resumeFrom } = event.data;

    /** Update campaign status + optional fields */
    const updateStatus = async (status: CampaignStatus, progress: number, data?: Record<string, unknown>) => {
      const updatePayload: Record<string, unknown> = {
        status,
        progress,
        updated_at: new Date().toISOString(),
      };

      if (data?.script_content) updatePayload.script_content = data.script_content;
      if (data?.audio_url)      updatePayload.audio_url      = data.audio_url;
      if (data?.video_url)      updatePayload.video_url      = data.video_url;
      if (data?.thumbnail_url)  updatePayload.thumbnail_url  = data.thumbnail_url;
      if (data?.error_message)  updatePayload.error_message  = data.error_message;

      const db = await getD1Client();
      const { error } = await db
        .from("campaigns")
        .update(updatePayload)
        .eq("id", campaignId);

      if (error) throw new Error(`Failed to update status: ${(error as { message?: string }).message}`);
    };

    /** Send Telegram notification to user if enabled */
    const notifyUser = async (message: string) => {
      const db = await getD1Client();
      const { data, error } = await db
        .from("user_profiles")
        .select("telegram_chat_id, settings")
        .eq("user_id", userId)
        .single();

      const profile = data as {
        telegram_chat_id: string | null;
        settings: { notifications?: { telegram?: { enabled?: boolean } } } | null;
      } | null;

      if (error || !profile?.telegram_chat_id) return;

      const telegramEnabled = profile.settings?.notifications?.telegram?.enabled === true;
      if (!telegramEnabled) return;

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

    // Step 1: Generate Script (skip if resuming from tts/video/finalize)
    const script = await step.run("generate-script", async () => {
      if (resume && (resumeFrom === "tts" || resumeFrom === "video" || resumeFrom === "finalize")) {
        const db = await getD1Client();
        const { data: campaign } = await db
          .from("campaigns")
          .select("script_content")
          .eq("id", campaignId)
          .single();

        const typedCampaign = campaign as { script_content: Record<string, unknown> | null } | null;
        if (!typedCampaign?.script_content) {
          throw new Error("Cannot resume: script content not found");
        }
        return typedCampaign.script_content;
      }

      await updateStatus("processing_script", 10);
      const scriptService = ServiceFactory.getScriptService();
      // `orgId: userId` is the single-tenant Sophia idiom (matches
      // src/app/api/raas/missions/route.ts:40). Real org_members lookup
      // deferred to Phase 4F.1 — the cache PK composite + hash-prefix
      // isolation still holds correctness either way.
      const result = await scriptService.generateScript({ topic, audience, tier, orgId: userId });
      await updateStatus("processing_script", 35, { script_content: result });
      await resumeEngine.checkpoint(campaignId, "generate-script");
      return result;
    });

    // Step 2: Generate Voiceover/TTS (skip if resuming from video/finalize)
    await step.run("generate-voiceover", async () => {
      if (resume && (resumeFrom === "video" || resumeFrom === "finalize")) {
        const db = await getD1Client();
        const { data: campaign } = await db
          .from("campaigns")
          .select("audio_url")
          .eq("id", campaignId)
          .single();

        const typedCampaign = campaign as { audio_url: string | null } | null;
        if (!typedCampaign?.audio_url) {
          throw new Error("Cannot resume: audio URL not found");
        }
        return typedCampaign.audio_url;
      }

      const scriptData = script as { scenes: Array<{ narration: string }> };
      const fullNarration = scriptData.scenes.map(s => s.narration).join(' ');

      await updateStatus("processing_script", 45);
      if (!resume) {
        await notifyUser(`📝 Script ready! Now generating voiceover...`);
      }

      const voiceService = ServiceFactory.getVoiceService();
      const voiceoverResult = await voiceService.generateVoiceover({ text: fullNarration, tier });

      await updateStatus("processing_script", 60, { audio_url: voiceoverResult.audio_url });
      await resumeEngine.checkpoint(campaignId, "generate-voiceover");
      return voiceoverResult.audio_url;
    });

    // Step 3: Start Video Generation
    const videoJobId = await step.run("start-video-generation", async () => {
      if (resume && resumeFrom === "finalize") return null;

      await updateStatus("processing_video", 70);
      if (!resume) {
        await notifyUser(`🎤 Voiceover ready! Now rendering video... (This may take a few minutes)`);
      }

      return await startVideoGeneration({ script, tier });
    });

    // Step 4: Poll Video Status (10 min max, 120 attempts × 5s)
    const videoAssets = await step.run("poll-video-status", async () => {
      if (resume && resumeFrom === "finalize") {
        const db = await getD1Client();
        const { data: campaign } = await db
          .from("campaigns")
          .select("video_url, thumbnail_url")
          .eq("id", campaignId)
          .single();

        const typedCampaign = campaign as { video_url: string | null; thumbnail_url: string | null } | null;
        if (!typedCampaign?.video_url) {
          throw new Error("Cannot resume: video URL not found");
        }
        return {
          video_url: typedCampaign.video_url,
          thumbnail_url: typedCampaign.thumbnail_url || ""
        };
      }

      if (!videoJobId) throw new Error("Video Job ID missing");

      const maxAttempts = 120;
      const pollIntervalMs = 5000;
      const isTransientError = (err: unknown): boolean => {
        if (!(err instanceof Error)) return false;
        const msg = err.message.toLowerCase();
        return msg.includes('network') || msg.includes('503') || msg.includes('timeout') || msg.includes('econnreset');
      };

      let attempts = 0;
      while (attempts < maxAttempts) {
        let status: Awaited<ReturnType<typeof checkVideoGenerationStatus>>;
        try {
          status = await checkVideoGenerationStatus(videoJobId, tier);
        } catch (err) {
          if (isTransientError(err)) {
            logger.warn(`[poll-video-status] Transient error on attempt ${attempts}, retrying once`, { campaignId });
            await new Promise(r => setTimeout(r, pollIntervalMs));
            try {
              status = await checkVideoGenerationStatus(videoJobId, tier);
            } catch (retryErr) {
              logger.error(`[poll-video-status] Retry also failed`, retryErr instanceof Error ? retryErr : undefined, { campaignId });
              await new Promise(r => setTimeout(r, pollIntervalMs));
              attempts++;
              continue;
            }
          } else {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.error(`[poll-video-status] Permanent error`, err instanceof Error ? err : undefined, { campaignId });
            await updateStatus("failed", 70, { error_message: errMsg });
            await notifyUser(`❌ **Sophia AI**: Video generation failed for "${topic}". Error: ${errMsg}`);
            throw new Error(errMsg);
          }
        }

        if (status!.status === 'completed' && status!.output) {
          return status!.output;
        }

        if (status!.status === 'failed') {
          const errMsg = status!.error || 'Video generation failed';
          logger.error(`[poll-video-status] HeyGen reported failure`, undefined, { campaignId, error: errMsg });
          await updateStatus("failed", 70, { error_message: errMsg });
          await notifyUser(`❌ **Sophia AI**: Video generation failed for "${topic}". Error: ${errMsg}`);
          throw new Error(errMsg);
        }

        await new Promise(r => setTimeout(r, pollIntervalMs));
        attempts++;
      }

      logger.warn(`[poll-video-status] Timed out after ${maxAttempts} attempts`, { campaignId });
      await updateStatus("video_timeout" as CampaignStatus, 70, { error_message: "Video generation timed out after 10 minutes" });
      await notifyUser(`⏱️ **Sophia AI**: Video generation for "${topic}" timed out. Please retry or contact support.`);
      throw new Error("Video generation timed out after 10 minutes");
    });

    // Step 4b: Checkpoint after video ready
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
