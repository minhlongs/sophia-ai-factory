import { IVideoService, IVoiceService, IScriptService, IPaymentService } from "./types";
import { MockVideoService } from "./mock/video-service";
import { MockVoiceService } from "./mock/voice-service";
import { MockScriptService } from "./mock/script-service";
import { RealVideoService } from "./real/video-service";
import { RealVoiceService } from "./real/voice-service";
import { RealScriptService } from "./real/script-service";
import { MockPaymentService } from "./mock/payment-service";
import { RealPaymentService } from "./real/payment-service";
import { MissingCredentialsError } from "./errors";
import { logger } from "@/seed/utils/logger-utility";
import { resolveUserApiKey } from "@/tree/byok/resolve-user-api-key";
import { getUserApiKey } from "@/tree/byok/user-api-key-store";
import { isByokEnabled } from "@/tree/byok/resolve-user-api-key";

const isProd = process.env.NODE_ENV === 'production'
const isExplicitMock = process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true'

/**
 * Per-service credential gate (sync, for env-only path).
 *
 * Decision tree:
 *   NEXT_PUBLIC_MOCK_AI_SERVICES=true  → false (mock allowed, test mode)
 *   key present                        → true  (use real service)
 *   NODE_ENV=production + key absent   → throws MissingCredentialsError
 *   dev/staging + key absent           → false (mock fallback + warning)
 */
function requireKey(name: string): boolean {
  if (isExplicitMock) return false
  const value = process.env[name]?.trim(); if (value) return true
  if (isProd) throw new MissingCredentialsError(name)
  logger.warn(`[ServiceFactory] ${name} not set — falling back to mock service (dev/staging only)`)
  return false
}

/**
 * Async credential gate for ByokProvider-registered providers (openrouter, elevenlabs, etc.).
 * Resolves user key first; falls back to env. Returns null → mock.
 */
async function resolveKey(
  envName: string,
  provider: Parameters<typeof resolveUserApiKey>[1],
  userId?: string,
): Promise<string | null> {
  if (isExplicitMock) return null
  const envKey = process.env[envName]?.trim() || undefined
  if (!userId) {
    if (envKey) return envKey
    if (isProd) throw new MissingCredentialsError(envName)
    logger.warn(`[ServiceFactory] ${envName} not set — falling back to mock service (dev/staging only)`)
    return null
  }
  const key = await resolveUserApiKey(userId, provider, envKey)
  if (!key) {
    if (isProd) throw new MissingCredentialsError(envName)
    logger.warn(`[ServiceFactory] ${envName} not resolvable for user — falling back to mock service (dev/staging only)`)
  }
  return key
}

/**
 * Async credential gate for 'heygen'.
 * Resolution: user BYOK key (if BYOK enabled + userId given) → env fallback → null (mock).
 */
async function resolveHeygenKey(userId?: string): Promise<string | null> {
  if (isExplicitMock) return null
  const envKey = process.env['HEYGEN_API_KEY']?.trim() || null
  if (!userId) {
    if (envKey) return envKey
    if (isProd) throw new MissingCredentialsError('HEYGEN_API_KEY')
    logger.warn('[ServiceFactory] HEYGEN_API_KEY not set — falling back to mock service (dev/staging only)')
    return null
  }
  if (isByokEnabled()) {
    const userKey = await getUserApiKey(userId, 'heygen')
    const key = userKey ?? envKey
    if (!key) {
      if (isProd) throw new MissingCredentialsError('HEYGEN_API_KEY')
      logger.warn('[ServiceFactory] HEYGEN_API_KEY not resolvable for user — falling back to mock service (dev/staging only)')
    }
    return key
  }
  if (!envKey) {
    if (isProd) throw new MissingCredentialsError('HEYGEN_API_KEY')
    logger.warn('[ServiceFactory] HEYGEN_API_KEY not set — falling back to mock service (dev/staging only)')
  }
  return envKey
}

export class ServiceFactory {
  /**
   * Returns a ScriptService resolved for the given user (BYOK) or env fallback.
   * @param userId - optional; BYOK resolution attempted for 'openrouter' when provided
   */
  static async getScriptService(userId?: string): Promise<IScriptService> {
    const key = await resolveKey('OPENROUTER_API_KEY', 'openrouter', userId)
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
   * Returns a VideoService resolved for the given user (BYOK/heygen) or env fallback.
   * @param userId - optional; BYOK resolution attempted for 'heygen' when provided
   */
  static async getVideoService(userId?: string): Promise<IVideoService> {
    const key = await resolveHeygenKey(userId)
    return key ? new RealVideoService(userId) : new MockVideoService()
  }

  /** Payment service — no BYOK (always env-driven, NOWPayments only). */
  static getPaymentService(): IPaymentService {
    return requireKey('NOWPAYMENTS_API_KEY') ? new RealPaymentService() : new MockPaymentService()
  }
}
