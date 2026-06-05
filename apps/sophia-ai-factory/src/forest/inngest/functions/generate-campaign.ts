import { NonRetriableError } from 'inngest'
import { inngest } from '@/forest/inngest/client'
import { logger } from '@/seed/utils/logger-utility'
import { ServiceFactory } from '@/land/services/factory'
import { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors'
import { startVideoGeneration } from '@/seed/ai/video-generator'
import { getD1Client } from '@/seed/db/client'
import { Tier } from '@/seed/types'
import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway'
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine'
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter'
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter'
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter'
import { resolveOrgId } from '@/seed/auth/resolve-org-id'
import { updateCampaignStatus, notifyUserByTelegram } from './generate-campaign-db'
import { notifyRefundRequired, notifyProviderError } from './generate-campaign-refund-notify'
import { pollVideoStatus } from './generate-campaign-video-poller'
import { emit } from '@/land/webhooks/emitter'

/** Resolve D1 binding for webhook emission (best-effort, no throw) */
function getD1ForWebhooks(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

const resumeEngine = new SmartResumeEngine()

function createGateway(): OpenClawGateway {
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 })
  gateway.registerChannel({ id: 'youtube',  name: 'YouTube',               adapter: new YouTubeChannelAdapter(),       enabled: true, rateLimitPerHour: 6  })
  gateway.registerChannel({ id: 'tiktok',   name: 'TikTok',                adapter: new TikTokChannelAdapter(),        enabled: true, rateLimitPerHour: 10 })
  gateway.registerChannel({ id: 'telegram', name: 'Telegram Notifications', adapter: new TelegramNotificationAdapter(), enabled: true, rateLimitPerHour: 60 })
  return gateway
}

interface AffiliateOfferSelectedRow {
  short_code: string;
  offer_name: string;
  affiliate_link: string;
}

export const generateCampaign = inngest.createFunction(
  { id: 'generate-campaign', retries: 3 },
  { event: 'campaign.created' },
   async ({ event, step }) => {
  const eventData = event.data as unknown as {
    campaignId: string
    userId: string
    topic: string
    audience: string
    tier: Tier
    resume?: boolean
    resumeFrom?: string
  }
  const { campaignId, userId, topic, audience, tier, resume, resumeFrom } = eventData

 // ── Idempotency guard: skip if campaign already processing or completed ────
  if (!resume) {
    const idempotencyDb = await getD1Client();
 const { data: existingCampaign } = await idempotencyDb
  .from('campaigns')
  .select('id, status')
  .eq('id', campaignId as string)
  .single() as { data: { id: string; status: string } | null };
    if (existingCampaign && ['processing_script', 'processing_video', 'completed'].includes(existingCampaign.status)) {
      logger.info('[generateCampaign] Campaign already processed — skipping', { campaignId, status: existingCampaign.status });
      return { skipped: true, campaignId };
    }
  }

   const updateStatus = (status: Parameters<typeof updateCampaignStatus>[1], progress: number, data?: Record<string, unknown>) =>
      updateCampaignStatus(campaignId, status, progress, data)
    const notifyUser = (message: string) => notifyUserByTelegram(userId, message)

    await step.run('notify-start', async () => {
      await notifyUser(resume
        ? `🔄 **Sophia AI**: Resuming campaign for "${topic}" from ${resumeFrom} step...`
        : `🎬 **Sophia AI**: Starting campaign generation for "${topic}"...`)
    })

    // Load affiliate offer selection (if user picked one during campaign creation)
    const affiliateOffer = await step.run('load-affiliate-offer', async () => {
      try {
        const db = await getD1Client()
        const { data } = await db
          .from('affiliate_offers_selected')
          .select('short_code, offer_name, affiliate_link')
          .eq('campaign_id', campaignId)
          .single()
        const row = data as AffiliateOfferSelectedRow | null
        if (!row) return null
        const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'}/r/${row.short_code}`
        return { productName: row.offer_name, shortUrl }
      } catch (error) {
        logger.warn('[generate-campaign] failed to load affiliate offer for campaign', { campaignId, error: String(error) })
        return null
      }
    })

    const script = await step.run('generate-script', async () => {
      if (resume && (resumeFrom === 'tts' || resumeFrom === 'video' || resumeFrom === 'finalize')) {
        const db = await getD1Client()
        const { data: campaign } = await db.from('campaigns').select('script_content').eq('id', campaignId as string).single()
        const typedCampaign = campaign as { script_content: Record<string, unknown> | null } | null
        if (!typedCampaign?.script_content) throw new Error('Cannot resume: script content not found')
        return typedCampaign.script_content
      }
      await updateStatus('processing_script', 10)
      try {
        const scriptService = await ServiceFactory.getScriptService(userId)
        const resolvedOrgId = (await resolveOrgId(userId)) ?? userId
        const result = await scriptService.generateScript({
          topic, audience, tier, orgId: resolvedOrgId, userId,
          affiliateOffer: affiliateOffer ?? undefined,
        })
        await updateStatus('processing_script', 35, { script_content: result })
        await resumeEngine.checkpoint(campaignId, 'generate-script')
        return result
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key)
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err })
        }
        if (err instanceof ProviderQuotaExceededError) {
          await notifyProviderError(userId, campaignId, err.service, 'quota', err.message)
          throw new NonRetriableError(err.message, { cause: err })
        }
        if (err instanceof ProviderInvalidKeyError) {
          await notifyProviderError(userId, campaignId, err.service, 'key', err.message)
          throw new NonRetriableError(err.message, { cause: err })
        }
        throw err
      }
    })

    await step.run('generate-voiceover', async () => {
      if (resume && (resumeFrom === 'video' || resumeFrom === 'finalize')) {
        const db = await getD1Client()
        const { data: campaign } = await db.from('campaigns').select('audio_url').eq('id', campaignId as string).single()
        const typedCampaign = campaign as { audio_url: string | null } | null
        if (!typedCampaign?.audio_url) throw new Error('Cannot resume: audio URL not found')
        return typedCampaign.audio_url
      }
      const scriptData = script as { scenes: Array<{ narration: string }> }
      const fullNarration = scriptData.scenes.map(s => s.narration).join(' ')
      await updateStatus('processing_script', 45)
      if (!resume) await notifyUser(`📝 Script ready! Now generating voiceover...`)
      try {
        const voiceService = await ServiceFactory.getVoiceService(userId)
        const voiceoverResult = await voiceService.generateVoiceover({ text: fullNarration, tier, userId })
        await updateStatus('processing_script', 60, { audio_url: voiceoverResult.audio_url })
        await resumeEngine.checkpoint(campaignId, 'generate-voiceover')
        return voiceoverResult.audio_url
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key)
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err })
        }
        if (err instanceof ProviderQuotaExceededError) {
          await notifyProviderError(userId, campaignId, err.service, 'quota', err.message)
          throw new NonRetriableError(err.message, { cause: err })
        }
        if (err instanceof ProviderInvalidKeyError) {
          await notifyProviderError(userId, campaignId, err.service, 'key', err.message)
          throw new NonRetriableError(err.message, { cause: err })
        }
        throw err
      }
    })

    const videoJobId = await step.run('start-video-generation', async () => {
      if (resume && resumeFrom === 'finalize') return null
      await updateStatus('processing_video', 70)
      if (!resume) await notifyUser(`🎤 Voiceover ready! Now rendering video...`)
      try {
        return await startVideoGeneration({ script, tier, userId })
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key)
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err })
        }
        if (err instanceof ProviderQuotaExceededError) {
          await notifyProviderError(userId, campaignId, err.service, 'quota', err.message)
          throw new NonRetriableError(err.message, { cause: err })
        }
        if (err instanceof ProviderInvalidKeyError) {
          await notifyProviderError(userId, campaignId, err.service, 'key', err.message)
          throw new NonRetriableError(err.message, { cause: err })
        }
        throw err
      }
    })

    const videoAssets = await step.run('poll-video-status', async () => {
      if (resume && resumeFrom === 'finalize') {
        const db = await getD1Client()
        const { data: campaign } = await db.from('campaigns').select('video_url, thumbnail_url').eq('id', campaignId as string).single()
        const typedCampaign = campaign as { video_url: string | null; thumbnail_url: string | null } | null
        if (!typedCampaign?.video_url) throw new Error('Cannot resume: video URL not found')
        return { video_url: typedCampaign.video_url, thumbnail_url: typedCampaign.thumbnail_url || '' }
      }
      if (!videoJobId) throw new Error('Video Job ID missing')
      return await pollVideoStatus(videoJobId, tier, campaignId, { onUpdate: updateStatus, onNotify: notifyUser, topic })
    })

    await step.run('checkpoint-video-ready', async () => {
      await resumeEngine.checkpoint(campaignId, 'poll-video-status', { video_url: videoAssets.video_url, thumbnail_url: videoAssets.thumbnail_url })
    })

    const distributionResult = await step.run('distribute-channels', async () => {
      const gateway = createGateway()
      const campaignTitle = topic || `Campaign ${campaignId}`
      const baseDesc = `AI-generated video content for ${audience || 'general audience'}`
      const description = affiliateOffer
        ? `${baseDesc}\n\n👉 ${affiliateOffer.shortUrl}`
        : baseDesc
      const payload = {
        campaignId, videoUrl: videoAssets.video_url, thumbnailUrl: videoAssets.thumbnail_url || undefined,
        title: campaignTitle, description,
        tags: ['sophia-ai', 'auto-generated', tier.toLowerCase()],
      }
      const result = await gateway.distribute(payload)
      if (!result.allSucceeded) {
        const healed = await gateway.selfHeal({ ...payload, description }, result)
        await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: healed.allSucceeded, channelCount: healed.results.length })
        return healed
      }
      await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: result.allSucceeded, channelCount: result.results.length })
      return result
    })

    await step.run('finalize-campaign', async () => {
      await updateStatus('completed', 100, { video_url: videoAssets.video_url, thumbnail_url: videoAssets.thumbnail_url })
      const distributedChannels = distributionResult.results.filter(r => r.success).map(r => r.channelId).join(', ')
      const statusLine = distributionResult.allSucceeded
        ? `Published to: ${distributedChannels}`
        : `Partially published (${distributedChannels}). Some channels failed.`
      await notifyUser(`✅ **Campaign Ready!**\nYour video for "${topic}" is ready.\n${statusLine}\n[Watch Video](${videoAssets.video_url})`)
      await resumeEngine.checkpoint(campaignId, 'finalize-campaign')
      await resumeEngine.clearCheckpoints(campaignId)

      // Emit outbound webhook events (fire-and-forget, best-effort)
      const db = getD1ForWebhooks();
      if (db) {
        const webhookEnv = { DB: db };
        emit(webhookEnv, 'mission.completed', {
          missionId: campaignId,
          tenantId: userId,
          status: 'completed',
          videoUrl: videoAssets.video_url,
          durationSec: null,
          costUsd: null,
        }, userId);
        emit(webhookEnv, 'video.ready', {
          videoId: videoAssets.video_url,
          missionId: campaignId,
          tenantId: userId,
          r2Key: null,
          publicUrl: videoAssets.video_url,
          durationSec: null,
        }, userId);
      }
    })

    return { success: true, campaignId }
  }
)
