/**
 * Client algorithms methods part of the TypeScript SDK template
 *
 * Layer: app/api/sdk/typescript
 */

export const SDK_CLIENT_ALGORITHMS_PART = `
  readonly algorithms = {
    affiliateDescription: (videoId: string, opts: AffiliateDescriptionOptions = {}, ro: RequestOptions = {}): Promise<AffiliateDescription> => {
      const qp = new URLSearchParams();
      if (opts.niche) qp.set('niche', opts.niche);
      if (opts.max) qp.set('max', String(opts.max));
      const q = qp.toString();
      return this.request<AffiliateDescription>(\`/api/videos/\${videoId}/description-enriched\${q ? \`?\${q}\` : ''}\`, {}, ro);
    },

    translate: (input: TranslateInput, ro: RequestOptions = {}): Promise<TranslateResult> => {
      return this.request<TranslateResult>('/api/translate', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    cloneVoice: (input: VoiceCloneInput, ro: RequestOptions = {}): Promise<VoiceCloneResult> => {
      return this.request<VoiceCloneResult>('/api/voice/clone', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    seoScript: (input: SeoScriptInput, ro: RequestOptions = {}): Promise<SeoScriptResult> => {
      return this.request<SeoScriptResult>('/api/scripts/seo', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    liveStats: (ro: RequestOptions = {}): Promise<LiveStats> => {
      return this.request<LiveStats>('/api/stats/live', {}, ro);
    },

    schedulePublish: (input: PublishScheduleInput, ro: RequestOptions = {}): Promise<PublishScheduleResult> => {
      return this.request<PublishScheduleResult>('/api/publish/quick-schedule', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },

    registerChannel: (input: RegisterChannelInput, ro: RequestOptions = {}): Promise<RegisterChannelResult> => {
      return this.request<RegisterChannelResult>('/api/publish/channels', {
        method: 'POST',
        body: JSON.stringify(input),
      }, ro);
    },
  };

  affiliateDescription(videoId: string, opts?: AffiliateDescriptionOptions, ro?: RequestOptions): Promise<AffiliateDescription> {
    return this.algorithms.affiliateDescription(videoId, opts, ro);
  }

  translate(input: TranslateInput, ro?: RequestOptions): Promise<TranslateResult> {
    return this.algorithms.translate(input, ro);
  }

  cloneVoice(input: VoiceCloneInput, ro?: RequestOptions): Promise<VoiceCloneResult> {
    return this.algorithms.cloneVoice(input, ro);
  }

  seoScript(input: SeoScriptInput, ro?: RequestOptions): Promise<SeoScriptResult> {
    return this.algorithms.seoScript(input, ro);
  }

  liveStats(ro?: RequestOptions): Promise<LiveStats> {
    return this.algorithms.liveStats(ro);
  }

  schedulePublish(input: PublishScheduleInput, ro?: RequestOptions): Promise<PublishScheduleResult> {
    return this.algorithms.schedulePublish(input, ro);
  }

  registerChannel(input: RegisterChannelInput, ro?: RequestOptions): Promise<RegisterChannelResult> {
    return this.algorithms.registerChannel(input, ro);
  }
}

export default SophiaClient;
`;
