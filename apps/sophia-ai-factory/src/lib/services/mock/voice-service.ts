import { IVoiceService, GenerateVoiceoverInput, VoiceoverOutput } from "../types";

export class MockVoiceService implements IVoiceService {
  async generateVoiceover(input: GenerateVoiceoverInput): Promise<VoiceoverOutput> {

    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Public domain or safe sample audio
    const mockAudioUrls = input.tier === 'ENTERPRISE'
    ? [
        "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
        "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav"
      ]
    : [
        "https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav",
        "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav"
      ];

    const selectedUrl = mockAudioUrls[Math.floor(Math.random() * mockAudioUrls.length)];

    return {
      audio_url: selectedUrl,
      duration: Math.floor(input.text.length / 15) // Rough estimate
    };
  }
}
