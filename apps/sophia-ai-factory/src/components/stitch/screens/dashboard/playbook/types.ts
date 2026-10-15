import type { ReactNode } from 'react';
import type { useTranslations } from 'next-intl';
import type { PlaybookOverviewData } from '@/land/playbook/actions';
import type { MissionPreflightResult } from '@/tree/mission/preflight-check';

export interface PlaybookPageProps {
  userId?: string;
  workspaceId?: string;
  initialData?: PlaybookOverviewData | null;
}

export type PlaybookTab = 'patterns' | 'rules' | 'schedules';

export interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

export interface BatchRunResult {
  batchId: string;
  missionIds: string[];
  preflight?: MissionPreflightResult;
}

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export type PlaybookTranslation = ReturnType<typeof useTranslations<'dashboard.playbook'>>;
