export type FeedbackCheckpoint =
  | 'mission_complete'
  | 'creative_rejected'
  | 'human_correction'
  | 'mission_abandoned';

export type FeedbackUseful = 'YES' | 'NO';

export type FeedbackReason =
  | 'WRONG'
  | 'LOW_QUALITY'
  | 'NOT_MY_STYLE'
  | 'TOO_EXPENSIVE'
  | 'TOO_SLOW'
  | 'TOO_COMPLEX'
  | 'NOT_USEFUL'
  | 'OTHER';

export interface FeedbackInput {
  workspaceId: string;
  missionId: string;
  checkpoint: FeedbackCheckpoint;
  useful: FeedbackUseful;
  reason?: FeedbackReason | null;
  freeText?: string | null;
}

export interface FeedbackRow {
  id: string;
  workspace_id: string;
  mission_id: string;
  checkpoint: string;
  useful: string;
  reason: string | null;
  free_text: string | null;
  idempotency_key: string;
  created_at: number;
}

export interface FeedbackStored {
  id: string;
  workspaceId: string;
  missionId: string;
  checkpoint: FeedbackCheckpoint;
  useful: FeedbackUseful;
  reason: FeedbackReason | null;
  createdAt: number;
}

export interface FeedbackAggregate {
  total: number;
  usefulYes: number;
  usefulNo: number;
  byCheckpoint: Record<FeedbackCheckpoint, { yes: number; no: number }>;
  topReasons: { reason: FeedbackReason; count: number }[];
}

export const FEEDBACK_CHECKPOINTS: readonly FeedbackCheckpoint[] = [
  'mission_complete',
  'creative_rejected',
  'human_correction',
  'mission_abandoned',
];

export const FEEDBACK_REASONS: readonly FeedbackReason[] = [
  'WRONG',
  'LOW_QUALITY',
  'NOT_MY_STYLE',
  'TOO_EXPENSIVE',
  'TOO_SLOW',
  'TOO_COMPLEX',
  'NOT_USEFUL',
  'OTHER',
];

export const MAX_FREE_TEXT_LENGTH = 2000;
