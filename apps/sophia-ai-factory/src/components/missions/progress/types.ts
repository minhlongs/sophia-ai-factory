export type MissionStageId =
  | 'SCRIPT_GENERATION'
  | 'VOICE_SYNTHESIS'
  | 'VISUAL_GENERATION'
  | 'VIDEO_COMPOSITING'
  | 'READY_FOR_REVIEW';

export type StageKey =
  | 'script_generation'
  | 'voice_synthesis'
  | 'visual_generation'
  | 'video_compositing'
  | 'ready_for_review';

export interface StageDefinition {
  id: MissionStageId;
  stageKey: StageKey;
  stepNumber: number;
  labelEn: string;
  labelVi: string;
  descEn: string;
  descVi: string;
  percent: number;
}

export const MISSION_STAGES: StageDefinition[] = [
  {
    id: 'SCRIPT_GENERATION',
    stageKey: 'script_generation',
    stepNumber: 1,
    labelEn: 'Script Generation',
    labelVi: 'Soạn kịch bản SEO',
    descEn: 'Writing high-retention script with OpenRouter',
    descVi: 'Soạn kịch bản giữ chân người xem bằng AI',
    percent: 20,
  },
  {
    id: 'VOICE_SYNTHESIS',
    stageKey: 'voice_synthesis',
    stepNumber: 2,
    labelEn: 'Voice Synthesis',
    labelVi: 'Lồng tiếng AI',
    descEn: 'Synthesizing voiceover with ElevenLabs',
    descVi: 'Tạo giọng đọc tự nhiên bằng ElevenLabs',
    percent: 40,
  },
  {
    id: 'VISUAL_GENERATION',
    stageKey: 'visual_generation',
    stepNumber: 3,
    labelEn: 'Visual Generation',
    labelVi: 'Tạo hình ảnh AI',
    descEn: 'Rendering scenes with fal.ai',
    descVi: 'Dựng khung cảnh điện ảnh qua fal.ai',
    percent: 65,
  },
  {
    id: 'VIDEO_COMPOSITING',
    stageKey: 'video_compositing',
    stepNumber: 4,
    labelEn: 'Video Compositing',
    labelVi: 'Ghép video & Phụ đề',
    descEn: 'Assembling scenes, audio, and captions',
    descVi: 'Ghép cảnh, âm thanh và phụ đề chuyển động',
    percent: 90,
  },
  {
    id: 'READY_FOR_REVIEW',
    stageKey: 'ready_for_review',
    stepNumber: 5,
    labelEn: 'Ready for Review',
    labelVi: 'Sẵn sàng duyệt',
    descEn: 'Video complete! Ready for one-click approval',
    descVi: 'Video hoàn tất! Sẵn sàng để bạn xem và duyệt',
    percent: 100,
  },
];

export interface MissionProgressBarProps {
  currentStage: MissionStageId;
  status: 'idle' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  onRetry?: () => void;
  locale?: 'vi' | 'en';
  customPercent?: number;
}
