import { NonRetriableError } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { ServiceFactory } from '@/lib/services/factory'
import { MissingCredentialsError } from '@/lib/services/errors'
import { startVideoGeneration } from '@/lib/ai/video-generator'
import { getD1Client } from '@/lib/db/client'
import { OpenClawGateway } from '@/lib/gateway/openclaw-gateway'
import { SmartResumeEngine } from '@/lib/gateway/smart-resume-engine'
import { YouTubeChannelAdapter } from '@/lib/gateway/adapters/youtube-channel-adapter'
import { TikTokChannelAdapter } from '@/lib/gateway/adapters/tiktok-channel-adapter'
import { TelegramNotificationAdapter } from '@/lib/gateway/adapters/telegram-notification-adapter'
import { resolveOrgId } from '@/lib/auth/resolve-org-id'
import { updateCampaignStatus, notifyUserByTelegram } from './generate-campaign-db'
import { notifyRefundRequired } from './generate-campaign-refund-notify'
import { pollVideoStatus } from './generate-campaign-video-poller'

const resumeEngine = new SmartResumeEngine()

function createGateway(): OpenClawGateway {
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 })
  gateway.registerChannel({ id: 'youtube',  name: 'YouTube',               adapter: new YouTubeChannelAdapter(),       enabled: true, rateLimitPerHour: 6  })
  gateway.registerChannel({ id: 'tiktok',   name: 'TikTok',                adapter: new TikTokChannelAdapter(),        enabled: true, rateLimitPerHour: 10 })
  gateway.registerChannel({ id: 'telegram', name: 'Telegram Notifications', adapter: new TelegramNotificationAdapter(), enabled: true, rateLimitPerHour: 60 })
  return gateway
}

export const generateCampaign = inngest.createFunction(
  { id: 'generate-campaign', retries: 3 },
  { event: 'campaign.created' },
  async ({ event, step }) => {
    const { campaignId, userId, topic, audience, tier, resume, resumeFrom } = event.data

    const updateStatus = (status: Parameters<typeof updateCampaignStatus>[1], progress: number, data?: Record<string, unknown>) =>
      updateCampaignStatus(campaignId, status, progress, data)
    const notifyUser = (message: string) => notifyUserByTelegram(userId, message)

    await step.run('notify-start', async () => {
      await notifyUser(resume
        ? `🔄 **Sophia AI**: Resuming campaign for "${topic}" from ${resumeFrom} step...`
        : `🎬 **Sophia AI**: Starting campaign generation for "${topic}"...`)
    })

    const script = await step.run('generate-script', async () => {
      if (resume && (resumeFrom === 'tts' || resumeFrom === 'video' || resumeFrom === 'finalize')) {
        const db = await getD1Client()
        const { data: campaign } = await db.from('campaigns').select('script_content').eq('id', campaignId).single()
        const typedCampaign = campaign as { script_content: Record<string, unknown> | null } | null
        if (!typedCampaign?.script_content) throw new Error('Cannot resume: script content not found')
        return typedCampaign.script_content
      }
      await updateStatus('processing_script', 10)
      let scriptService
      try {
        scriptService = ServiceFactory.getScriptService()
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key)
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err })
        }
        throw err
      }
      const resolvedOrgId = (await resolveOrgId(userId)) ?? userId
      const result = await scriptService.generateScript({ topic, audience, tier, orgId: resolvedOrgId, userId })
      await updateStatus('processing_script', 35, { script_content: result })
      await resumeEngine.checkpoint(campaignId, 'generate-script')
      return result
    })

    await step.run('generate-voiceover', async () => {
      if (resume && (resumeFrom === 'video' || resumeFrom === 'finalize')) {
        const db = await getD1Client()
        const { data: campaign } = await db.from('campaigns').select('audio_url').eq('id', campaignId).single()
        const typedCampaign = campaign as { audio_url: string | null } | null
        if (!typedCampaign?.audio_url) throw new Error('Cannot resume: audio URL not found')
        return typedCampaign.audio_url
      }
      const scriptData = script as { scenes: Array<{ narration: string }> }
      const fullNarration = scriptData.scenes.map(s => s.narration).join(' ')
      await updateStatus('processing_script', 45)
      if (!resume) await notifyUser(`📝 Script ready! Now generating voiceover...`)
      let voiceService
      try {
        voiceService = ServiceFactory.getVoiceService()
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key)
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err })
        }
        throw err
      }
      const voiceoverResult = await voiceService.generateVoiceover({ text: fullNarration, tier })
      await updateStatus('processing_script', 60, { audio_url: voiceoverResult.audio_url })
      await resumeEngine.checkpoint(campaignId, 'generate-voiceover')
      return voiceoverResult.audio_url
    })

    const videoJobId = await step.run('start-video-generation', async () => {
      if (resume && resumeFrom === 'finalize') return null
      await updateStatus('processing_video', 70)
      if (!resume) await notifyUser(`🎤 Voiceover ready! Now rendering video...`)
      try {
        return await startVideoGeneration({ script, tier })
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key)
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err })
        }
        throw err
      }
    })

    const videoAssets = await step.run('poll-video-status', async () => {
      if (resume && resumeFrom === 'finalize') {
        const db = await getD1Client()
        const { data: campaign } = await db.from('campaigns').select('video_url, thumbnail_url').eq('id', campaignId).single()
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
      const payload = {
        campaignId, videoUrl: videoAssets.video_url, thumbnailUrl: videoAssets.thumbnail_url || undefined,
        title: campaignTitle, description: `AI-generated video content for ${audience || 'general audience'}`,
        tags: ['sophia-ai', 'auto-generated', tier.toLowerCase()],
      }
      const result = await gateway.distribute(payload)
      if (!result.allSucceeded) {
        const healed = await gateway.selfHeal({ ...payload, description: `AI-generated video for ${audience || 'general audience'}` }, result)
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
    })

    return { success: true, campaignId }
  }
)
