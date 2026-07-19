import type { VideoEngineCapabilities } from './video-engine-capabilities';
import type { VideoEngineResult, JobStatusResult } from './video-engine-result';
import type { CostEstimate } from './cost-estimate';
import type { TalkingHeadInput } from './talking-head-input';
import type { VoiceoverInput } from './voiceover-input';
import type { TextToVideoInput } from './text-to-video-input';

export interface VideoEngine {
  readonly id: string;
  readonly label: string;
  readonly capabilities: VideoEngineCapabilities;
  generateTalkingHead(input: TalkingHeadInput): Promise<VideoEngineResult>;
  generateVoiceover(input: VoiceoverInput): Promise<VideoEngineResult>;
  generateTextToVideo(input: TextToVideoInput): Promise<VideoEngineResult>;
  getJobStatus(jobId: string): Promise<JobStatusResult>;
  cancelJob(jobId: string): Promise<boolean>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: Record<string, unknown> }>;
  estimateCost(input: { type: 'talking_head' | 'voiceover' | 'text_to_video'; params: TalkingHeadInput | VoiceoverInput | TextToVideoInput }): Promise<CostEstimate>;
}
