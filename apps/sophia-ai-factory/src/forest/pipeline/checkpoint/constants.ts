/**
 * Pipeline checkpoint stage definitions and table constants
 *
 * @module forest/pipeline/checkpoint/constants
 */

export const CHECKPOINTS_TABLE = 'pipeline_checkpoints';
export const DECISION_LOGS_TABLE = 'pipeline_decision_logs';

export const VIDEO_GENERATION_STAGES = [
  'parse_input',
  'generate_tts',
  'generate_video',
  'poll_video_ready',
  'download_video',
  'generate_subtitles',
  'mux_audio_video',
  'update_mission',
  'emit_usage',
] as const;

export const REPURPOSE_STAGES = [
  'analyze',
  'clip_generate',
  'transcribe',
  'publish',
] as const;

export const CAMPAIGN_STAGES = [
  'scripting',
  'tts',
  'visual',
  'compose',
  'publish',
] as const;

export const PIPELINE_STAGE_MAP: Record<string, readonly string[]> = {
  video_generation: VIDEO_GENERATION_STAGES,
  video_repurpose: REPURPOSE_STAGES,
  campaign: CAMPAIGN_STAGES,
};
