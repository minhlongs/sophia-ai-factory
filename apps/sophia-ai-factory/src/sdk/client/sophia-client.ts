/**
 * Canonical SophiaClient implementation
 *
 * Layer: sdk
 */

import {
  type AffiliateDescription,
  type AffiliateDescriptionOptions,
  type LiveStats,
  type PublishScheduleInput,
  type PublishScheduleResult,
  type RegisterChannelInput,
  type RegisterChannelResult,
  type RequestOptions,
  type SeoScriptInput,
  type SeoScriptResult,
  type SophiaClientOptions,
  type TranslateInput,
  type TranslateResult,
  type VoiceCloneInput,
  type VoiceCloneResult,
} from './types';
import { executeHttpRequest, type TransportConfig } from './http-transport';
import { createMissionsApi } from './missions-api';
import { createAlgorithmsApi, createCreditsApi } from './credits-ai-api';

export class SophiaClient {
  private readonly config: TransportConfig;

  constructor(optsOrToken: SophiaClientOptions | string, baseUrl?: string) {
    if (typeof optsOrToken === 'string') {
      this.config = {
        apiKey: optsOrToken,
        baseUrl: (baseUrl ?? 'https://sophia.agencyos.network').replace(/\/$/, ''),
        timeoutMs: 30000,
      };
    } else {
      this.config = {
        apiKey: optsOrToken.apiKey ?? optsOrToken.token ?? '',
        baseUrl: (optsOrToken.baseUrl ?? baseUrl ?? 'https://sophia.agencyos.network').replace(/\/$/, ''),
        timeoutMs: optsOrToken.timeoutMs ?? 30000,
      };
    }

    const boundRequest = <T>(path: string, options?: RequestInit, ro?: RequestOptions): Promise<T> => {
      return executeHttpRequest<T>(this.config, path, options, ro);
    };

    this.missions = createMissionsApi(this.config, boundRequest);
    this.credits = createCreditsApi(boundRequest);
    this.algorithms = createAlgorithmsApi(boundRequest);
  }

  readonly missions: ReturnType<typeof createMissionsApi>;
  readonly credits: ReturnType<typeof createCreditsApi>;
  readonly algorithms: ReturnType<typeof createAlgorithmsApi>;

  // ─── Direct Convenience Delegates ─────────────────────────────────────────

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
