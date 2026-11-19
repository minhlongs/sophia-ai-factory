import { IVideoService, IVoiceService, IScriptService, IPaymentService } from "./types";
import { MockVideoService } from "./mock/video-service";
import { MockVoiceService } from "./mock/voice-service";
import { MockScriptService } from "./mock/script-service";
import { RealVideoService } from "./real/video-service";
import { RealVoiceService } from "./real/voice-service";
import { RealScriptService } from "./real/script-service";
import { ReplicateVideoService } from "./replicate/replicate-video-service";
import { MockPaymentService } from "./mock/payment-service";
import { RealPaymentService } from "./real/payment-service";
import { MissingCredentialsError, ProviderNetworkError } from "./errors";
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
import { logger } from "@/seed/utils/logger-utility";
import {
  isProd,
  isExplicitMock,
  requireKey,
  resolveKey,
  resolveHeygenKey,
  resolveReplicateKey,
} from "./factory-key-resolvers";

export class ServiceFactory {
  /**
   * Customer scripts require the owner's readable OpenRouter key.
   * Calls without a user retain the internal environment credential path.
   */
  static async getScriptService(userId?: string): Promise<IScriptService> {
    if (userId !== undefined) {
      const allowCustomerMock =
        process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true' &&
        globalThis.process.env.NODE_ENV === 'test'
      if (allowCustomerMock) return new MockScriptService()

      let lookup
      try {
        lookup = await lookupUserApiKey(userId, 'openrouter')
      } catch {
        throw new ProviderNetworkError('openrouter', 'Customer credential could not be read')
      }
      if (lookup.status === 'FOUND') {
        const apiKey = lookup.key.trim()
        if (apiKey) return new RealScriptService({ fund: 'byok', apiKey })
        throw new MissingCredentialsError('OPENROUTER_API_KEY')
      }
      if (lookup.status === 'NOT_CONFIGURED') {
        throw new MissingCredentialsError('OPENROUTER_API_KEY')
      }
      logger.warn('[ServiceFactory] Customer OpenRouter credential could not be read', {
        status: lookup.status,
      })
      throw new ProviderNetworkError('openrouter', 'Customer credential could not be read')
    }

    const key = await resolveKey('OPENROUTER_API_KEY', 'openrouter')
    return key ? new RealScriptService() : new MockScriptService()
  }

  /**
   * Returns a VoiceService resolved for the given user (BYOK) or env fallback.
   * @param userId - optional; BYOK resolution attempted for 'elevenlabs' when provided
   */
  static async getVoiceService(userId?: string): Promise<IVoiceService> {
    const key = await resolveKey('ELEVENLABS_API_KEY', 'elevenlabs', userId)
    return key ? new RealVoiceService(userId) : new MockVoiceService()
  }

  /**
   * Returns a VideoService resolved for the given user (BYOK) or env fallback.
   *
   * Resolution priority:
   * 1. Heygen key → RealVideoService (primary video provider)
   * 2. Replicate key → ReplicateVideoService (fallback for Wav2Lip)
   * 3. Neither → MockVideoService (dev) or throws (prod)
   *
   * In production, falls through gracefully: Heygen absence is caught and
   * Replicate is tried before throwing a MissingCredentialsError for the
   * provider the user actually needs to configure.
   *
   * @param userId - optional; BYOK resolution attempted for 'heygen' and 'replicate' when provided
   */
  static async getVideoService(userId?: string): Promise<IVideoService> {
    if (isExplicitMock) return new MockVideoService()

    // Try Heygen first — catch absence to attempt Replicate fallback
    try {
      const heygenKey = await resolveHeygenKey(userId)
      if (heygenKey) return new RealVideoService(userId)
    } catch {
      // Heygen not available — fall through to Replicate below
    }

    // Fallback to Replicate
    try {
      const replicateKey = await resolveReplicateKey(userId)
      if (replicateKey) return new ReplicateVideoService({ apiKey: replicateKey })
    } catch {
      // Neither available — fall through to mock/error below
    }

    // Neither provider configured
    if (isProd) {
      throw new MissingCredentialsError('HEYGEN_API_KEY / REPLICATE_API_TOKEN')
    }
    logger.warn('[ServiceFactory] No video service key (HEYGEN_API_KEY / REPLICATE_API_TOKEN) — falling back to mock (dev/staging only)')
    return new MockVideoService()
  }

  /**
   * Returns a ReplicateVideoService resolved for the given user (BYOK) or env fallback.
   * @param userId - optional; BYOK resolution attempted for 'replicate' when provided
   */
  static async getReplicateVideoService(userId?: string): Promise<IVideoService> {
    const key = await resolveReplicateKey(userId)
    return key ? new ReplicateVideoService({ apiKey: key }) : new MockVideoService()
  }

  /** Payment service — no BYOK (always env-driven, NOWPayments only). */
  static getPaymentService(): IPaymentService {
    return requireKey('NOWPAYMENTS_API_KEY') ? new RealPaymentService() : new MockPaymentService()
  }
}
