import { IVideoService, IVoiceService, IScriptService } from "./types";
import { MockVideoService } from "./mock/video-service";
import { MockVoiceService } from "./mock/voice-service";
import { MockScriptService } from "./mock/script-service";

// We will implement Real services next, for now importing types to avoid errors if we were strict
// But we can lazy load them or use a wrapper that imports the existing logic.

// To avoid circular dependencies or massive refactoring right now,
// we will define the Factory to return Mocks if the env var is set.
// For the Real implementation, we will create adapter classes in ./real/ folder that wrap the existing functions/classes.

import { RealVideoService } from "./real/video-service";
import { RealVoiceService } from "./real/voice-service";
import { RealScriptService } from "./real/script-service";
import { IPaymentService } from "./types";
import { MockPaymentService } from "./mock/payment-service";
import { RealPaymentService } from "./real/payment-service";

export class ServiceFactory {
  static getScriptService(): IScriptService {
    if (process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true') {
      return new MockScriptService();
    }
    return new RealScriptService();
  }

  static getVoiceService(): IVoiceService {
    if (process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true') {
      return new MockVoiceService();
    }
    return new RealVoiceService();
  }

  static getVideoService(): IVideoService {
    if (process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true') {
      return new MockVideoService();
    }
    return new RealVideoService();
  }

  static getPaymentService(): IPaymentService {
    if (process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true') {
      return new MockPaymentService();
    }
    return new RealPaymentService();
  }
}
