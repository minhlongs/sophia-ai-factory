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
import { logger } from "@/lib/utils/logger-utility";

const isProd = process.env.NODE_ENV === 'production'
const isExplicitMock = process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true'

/**
 * Per-service credential gate.
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

export class ServiceFactory {
  static getScriptService(): IScriptService {
    return requireKey('OPENROUTER_API_KEY') ? new RealScriptService() : new MockScriptService()
  }

  static getVoiceService(): IVoiceService {
    return requireKey('ELEVENLABS_API_KEY') ? new RealVoiceService() : new MockVoiceService()
  }

  static getVideoService(): IVideoService {
    return requireKey('HEYGEN_API_KEY') ? new RealVideoService() : new MockVideoService()
  }

  static getPaymentService(): IPaymentService {
    return requireKey('NOWPAYMENTS_API_KEY') ? new RealPaymentService() : new MockPaymentService()
  }
}
