import { IVoiceService, GenerateVoiceoverInput, VoiceoverOutput } from "../types";
import { generateVoiceover as legacyGenerateVoiceover } from "@/lib/ai/text-to-speech-generator-elevenlabs";

export class RealVoiceService implements IVoiceService {
  private readonly userId?: string;

  constructor(userId?: string) {
    this.userId = userId;
  }

  async generateVoiceover(input: GenerateVoiceoverInput): Promise<VoiceoverOutput> {
    // We delegate to the existing implementation which handles the API call
    return await legacyGenerateVoiceover({
      ...input,
      userId: input.userId ?? this.userId,
    });
  }
}
