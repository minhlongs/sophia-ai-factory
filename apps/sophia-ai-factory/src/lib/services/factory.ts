import { IVideoService, IVoiceService, IScriptService, IPaymentService } from "./types";
import { MockVideoService } from "./mock/video-service";
import { MockVoiceService } from "./mock/voice-service";
import { MockScriptService } from "./mock/script-service";
import { RealVideoService } from "./real/video-service";
import { RealVoiceService } from "./real/voice-service";
import { RealScriptService } from "./real/script-service";
import { MockPaymentService } from "./mock/payment-service";
import { RealPaymentService } from "./real/payment-service";

/**
 * Auto-enable mock mode when all AI service keys are absent.
 * Allows zero-config deployment without crashing on missing env vars.
 */
function isMockMode(): boolean {
  const autoMockMode =
    !process.env.OPENROUTER_API_KEY &&
    !process.env.HEYGEN_API_KEY &&
    !process.env.ELEVENLABS_API_KEY;
  return process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true' || autoMockMode;
}

export class ServiceFactory {
  static getScriptService(): IScriptService {
    return isMockMode() ? new MockScriptService() : new RealScriptService();
  }

  static getVoiceService(): IVoiceService {
    return isMockMode() ? new MockVoiceService() : new RealVoiceService();
  }

  static getVideoService(): IVideoService {
    return isMockMode() ? new MockVideoService() : new RealVideoService();
  }

  static getPaymentService(): IPaymentService {
    return isMockMode() ? new MockPaymentService() : new RealPaymentService();
  }
}
