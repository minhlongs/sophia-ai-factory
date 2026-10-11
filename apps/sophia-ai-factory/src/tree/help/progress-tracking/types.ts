/**
 * tree/help/progress-tracking/types.ts
 * Types for help video progress tracking.
 * Layer: tree (domain-specific reusable logic)
 */

export type {
  HelpVideoProgress,
  UserProgressSummary,
  HelpVideoCategory,
} from '../types';

export {
  HelpVideoProgressSchema,
  UserProgressSummarySchema,
} from '../types';

export interface CategoryProgressResult {
  category: import('../types').HelpVideoCategory;
  total: number;
  watched: number;
  completion_percentage: number;
}

export interface RecentlyWatchedRecord {
  video_id: string;
  watched_at: number;
}
