export interface SopStepDef {
  order: number;
  name_en: string;
  tool: 'ai-script' | 'ai-tts' | 'ai-video' | 'manual' | 'upload' | 'analytics';
  config?: Record<string, unknown>;
}

export interface SopStepResult {
  step_order: number;
  step_name: string;
  status: 'completed' | 'failed';
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: number;
  completed_at: number;
  duration_ms: number;
}

export interface AnalyticsContext {
  executionId: string;
  sopTemplateId: string;
  userId: string;
}
