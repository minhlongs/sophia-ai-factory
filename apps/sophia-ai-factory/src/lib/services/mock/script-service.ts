import { IScriptService, GenerateScriptInput, ScriptOutput } from "../types";

export class MockScriptService implements IScriptService {
  async generateScript(input: GenerateScriptInput): Promise<ScriptOutput> {
    console.log("[MockScriptService] Generating script for:", input.topic);

    return {
      title: `The Ultimate Guide to ${input.topic} (Mock)`,
      scenes: [
        {
          scene_number: 1,
          visual_description: "Fast-paced montage of successful people working.",
          narration: `Are you tired of failing at ${input.topic}? You're not alone.`,
          duration_estimate: 5
        },
        {
          scene_number: 2,
          visual_description: "Graphic showing statistics rising.",
          narration: `In this video, I'm going to show you the secret method that ${input.audience} are using to dominate.`,
          duration_estimate: 8
        },
        {
          scene_number: 3,
          visual_description: "Host speaking directly to camera with confidence.",
          narration: "Let's dive in.",
          duration_estimate: 3
        }
      ],
      total_duration: 16
    };
  }
}
