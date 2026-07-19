export interface VideoEngineCapabilities {
  generationTypes: ('talking_head' | 'voiceover' | 'text_to_video')[];
  maxDurationSeconds: number;
  minDurationSeconds: number;
  maxResolution: string;
  outputFormats: string[];
  imageFormats: string[];
  audioFormats: string[];
  realTime: boolean;
  batch: boolean;
  maxConcurrentJobs: number;
  customAvatars: boolean;
  voiceCloning: boolean;
  lipSync: boolean;
}
