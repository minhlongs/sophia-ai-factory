export interface TextToVideoInput {
  prompt: string;
  negativePrompt?: string;
  style?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  seed?: number;
  cfgScale?: number;
  referenceImageUrl?: string;
  outputFormat?: string;
}
