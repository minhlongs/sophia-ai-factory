import { inngest } from "@/lib/inngest/client";
import { generateScript } from "@/lib/ai/script-generator";
import { generateVideo } from "@/lib/ai/video-generator";
import { generateVoiceover } from "@/lib/ai/text-to-speech-generator-elevenlabs";
import { sendTelegramMessage } from "@/lib/telegram/telegram-client";
import { createClient } from "@supabase/supabase-js";
import { CampaignStatus } from "@/types";
import { Database } from "@/lib/supabase/types";

// Initialize Supabase Admin client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data?.script_content) updatePayload.script_content = data.script_content as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data?.audio_url) (updatePayload as any).audio_url = data.audio_url as string;
      if (data?.video_url) updatePayload.video_url = data.video_url as string;
      if (data?.thumbnail_url) updatePayload.thumbnail_url = data.thumbnail_url as string;
      if (data?.error_message) updatePayload.error_message = data.error_message as string;

      const { error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("campaigns") as any)
        .update(updatePayload)
        .eq("id", campaignId);

      if (error) throw new Error(`Failed to update status: ${error.message}`);
    };

    // Helper to send notification
    const notifyUser = async (message: string) => {
      // 1. Fetch user's telegram chat ID and settings
      const { data, error } = await supabase
        .from("user_profiles")
        .select("telegram_chat_id, settings")
        .eq("user_id", userId)
        .single();

      // Cast to expected type to avoid inference issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = data as { telegram_chat_id: string | null; settings: any } | null;

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
        const { data: campaign } = await supabase
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
      const result = await generateScript({ topic, audience, tier });
      await updateStatus("processing_script", 35, { script_content: result });
      return result;
    });

    // Step 2: Generate Voiceover/TTS (skip if resuming from video or finalize)
    const audioUrl = await step.run("generate-voiceover", async () => {
      if (resume && (resumeFrom === "video" || resumeFrom === "finalize")) {
        // Fetch existing audio from database
        const { data: campaign } = await supabase
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

      const voiceoverResult = await generateVoiceover({
        text: fullNarration,
        tier
      });

      await updateStatus("processing_script", 60, { audio_url: voiceoverResult.audio_url });
      return voiceoverResult.audio_url;
    });

    // Prevent unused variable warning
    console.log(`Audio generated/retrieved: ${audioUrl ? 'Yes' : 'No'}`);

    // Step 3: Generate Video (skip if resuming from finalize)
    const videoAssets = await step.run("generate-video", async () => {
      if (resume && resumeFrom === "finalize") {
        // Fetch existing video from database
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("video_url, thumbnail_url")
          .eq("id", campaignId)
          .single();

        // Type assertion for campaign data
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

      // Generate new video
      await updateStatus("processing_video", 70);
      if (!resume) {
        await notifyUser(`🎤 Voiceover ready! Now rendering video... (This may take a moment)`);
      }
      const result = await generateVideo({ script, tier });
      return result;
    });

    // Step 3: Finalize
    await step.run("finalize-campaign", async () => {
      await updateStatus("completed", 100, {
        video_url: videoAssets.video_url,
        thumbnail_url: videoAssets.thumbnail_url
      });
      await notifyUser(`✅ **Campaign Ready!**\nYour video for "${topic}" is ready.\n[Watch Video](${videoAssets.video_url})`);
    });

    return { success: true, campaignId };
  }
);
