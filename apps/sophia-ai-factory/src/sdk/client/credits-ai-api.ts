/**
 * Sophia Client SDK MCU Credits & AI Algorithms API
 *
 * Layer: sdk
 */

import {
  type AffiliateDescription,
  type AffiliateDescriptionOptions,
  type ConsumeCreditsOptions,
  type ConsumeCreditsResult,
  type LiveStats,
  type McuBalance,
  type PublishScheduleInput,
  type PublishScheduleResult,
  type RegisterChannelInput,
  type RegisterChannelResult,
  type RequestOptions,
  type SeoScriptInput,
  type SeoScriptResult,
  type TranslateInput,
  type TranslateResult,
  type VoiceCloneInput,
  type VoiceCloneResult,
} from './types';

type RequestFn = <T>(path: string, options?: RequestInit, ro?: RequestOptions) => Promise<T>;

export function createCreditsApi(request: RequestFn) {
  const balance = async (ro?: RequestOptions): Promise<McuBalance> => {
    return request<McuBalance>('/api/v1/credits', {}, ro);
  };

  return {
    balance,
    getBalance: balance,
    consume: async (opts: ConsumeCreditsOptions, ro?: RequestOptions): Promise<ConsumeCreditsResult> => {
      return request<ConsumeCreditsResult>('/api/v1/credits/consume', {
        method: 'POST',
        body: JSON.stringify(opts),
      }, ro);
    },
  };
}

export function createAlgorithmsApi(request: RequestFn) {
  return {
    affiliateDescription: (
      videoId: string,
      opts: AffiliateDescriptionOptions = {},
      ro: RequestOptions = {}
    ): Promise<AffiliateDescription> => {
      const qp = new URLSearchParams();
      if (opts.niche) qp.set('niche', opts.niche);
      if (opts.max) qp.set('max', String(opts.max));
      const q = qp.toString();
      return request<AffiliateDescription>(`/api/videos/${videoId}/description-enriched${q ? `?${q}` : ''}`, {}, ro);
    },

    translate: (input: TranslateInput, ro: RequestOptions = {}): Promise<TranslateResult> => {
      return request<TranslateResult>('/api/translate', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    cloneVoice: (input: VoiceCloneInput, ro: RequestOptions = {}): Promise<VoiceCloneResult> => {
      return request<VoiceCloneResult>('/api/voice/clone', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    seoScript: (input: SeoScriptInput, ro: RequestOptions = {}): Promise<SeoScriptResult> => {
      return request<SeoScriptResult>('/api/scripts/seo', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    liveStats: (ro: RequestOptions = {}): Promise<LiveStats> => {
      return request<LiveStats>('/api/stats/live', {}, ro);
    },

    schedulePublish: (input: PublishScheduleInput, ro: RequestOptions = {}): Promise<PublishScheduleResult> => {
      return request<PublishScheduleResult>('/api/publish/quick-schedule', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    registerChannel: (input: RegisterChannelInput, ro: RequestOptions = {}): Promise<RegisterChannelResult> => {
      return request<RegisterChannelResult>('/api/publish/channels', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },
  };
}
