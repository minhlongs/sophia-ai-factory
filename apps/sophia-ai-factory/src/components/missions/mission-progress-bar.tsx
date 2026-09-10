'use client';

/**
 * Mission Progress Bar — Live 5-Stage Visual Progress Tracker.
 * Displays real-time progress across: Script -> Voice -> Visuals -> Video -> Review.
 *
 * @module components/missions/mission-progress-bar
 */

import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export type MissionStageId =
  | 'SCRIPT_GENERATION'
  | 'VOICE_SYNTHESIS'
  | 'VISUAL_GENERATION'
  | 'VIDEO_COMPOSITING'
  | 'READY_FOR_REVIEW';

export interface StageDefinition {
  id: MissionStageId;
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
    stepNumber: 1,
    labelEn: 'Script Generation',
    labelVi: 'Soạn kịch bản SEO',
    descEn: 'Writing high-retention script with OpenRouter',
    descVi: 'Soạn kịch bản giữ chân người xem bằng AI',
    percent: 20,
  },
  {
    id: 'VOICE_SYNTHESIS',
    stepNumber: 2,
    labelEn: 'Voice Synthesis',
    labelVi: 'Lồng tiếng AI',
    descEn: 'Synthesizing voiceover with ElevenLabs',
    descVi: 'Tạo giọng đọc tự nhiên bằng ElevenLabs',
    percent: 40,
  },
  {
    id: 'VISUAL_GENERATION',
    stepNumber: 3,
    labelEn: 'Visual Generation',
    labelVi: 'Tạo hình ảnh AI',
    descEn: 'Rendering scenes with fal.ai',
    descVi: 'Dựng khung cảnh điện ảnh qua fal.ai',
    percent: 65,
  },
  {
    id: 'VIDEO_COMPOSITING',
    stepNumber: 4,
    labelEn: 'Video Compositing',
    labelVi: 'Ghép video & Phụ đề',
    descEn: 'Assembling scenes, audio, and captions',
    descVi: 'Ghép cảnh, âm thanh và phụ đề chuyển động',
    percent: 90,
  },
  {
    id: 'READY_FOR_REVIEW',
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

export function MissionProgressBar({
  currentStage,
  status,
  errorMessage,
  onRetry,
  locale = 'vi',
  customPercent,
}: MissionProgressBarProps) {
  const isVi = locale === 'vi';
  const currentIndex = MISSION_STAGES.findIndex((s) => s.id === currentStage);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentDef = MISSION_STAGES[activeIndex] ?? MISSION_STAGES[0];
  const percent = status === 'completed' ? 100 : (customPercent ?? currentDef.percent);

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header & Percentage */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {isVi ? 'Tiến độ sản xuất video' : 'Video Generation Progress'}
          </h3>
          <p className="text-xs text-muted-foreground">{isVi ? currentDef.descVi : currentDef.descEn}</p>
        </div>
        <span className="text-lg font-bold text-primary">{percent}%</span>
      </div>

      {/* Progress Bar Container */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={isVi ? 'Tiến độ nhiệm vụ' : 'Mission Progress'}
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full transition-all duration-500 ease-out ${
            status === 'failed' ? 'bg-destructive' : 'bg-primary'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 5 Stages Flow Indicator */}
      <div className="grid grid-cols-5 gap-1.5 pt-1">
        {MISSION_STAGES.map((stage, idx) => {
          const isPast = idx < activeIndex || status === 'completed';
          const isCurrent = idx === activeIndex && status !== 'completed';
          const isFailed = isCurrent && status === 'failed';

          return (
            <div key={stage.id} className="flex flex-col items-center text-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isFailed
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : isPast
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-primary bg-primary/20 text-primary ring-2 ring-primary/30'
                    : 'border-border bg-muted/40 text-muted-foreground'
                }`}
              >
                {isFailed ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : isPast ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent && status === 'running' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  stage.stepNumber
                )}
              </div>
              <span
                className={`mt-1.5 line-clamp-1 text-[10px] font-medium ${
                  isFailed ? 'text-destructive' : isCurrent || isPast ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {isVi ? stage.labelVi : stage.labelEn}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error State with Meaningful Feedback & Retry Path */}
      {status === 'failed' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <h4 className="text-xs font-semibold text-destructive">
                {isVi ? 'Quá trình xử lý tạm dừng' : 'Execution Interrupted'}
              </h4>
              <p className="text-[11px] text-foreground/80 mt-0.5">
                {errorMessage || (isVi ? 'Lỗi kết nối AI provider. Bấm thử lại an toàn.' : 'AI provider error. Retry safely.')}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 active:scale-95"
            >
              <RefreshCw className="h-3 w-3" />
              {isVi ? 'Thử lại' : 'Retry'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
