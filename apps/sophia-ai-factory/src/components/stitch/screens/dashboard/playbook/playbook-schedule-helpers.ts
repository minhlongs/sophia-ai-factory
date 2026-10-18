// i18n-namespace: dashboard.playbook
import {
  saveRecurringScheduleAction,
  toggleRecurringScheduleAction,
  triggerBatchRunAction,
  type PlaybookOverviewData,
} from '@/land/playbook/actions';
import type { RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { StatusMessage, BatchRunResult, PlaybookTranslation } from './types';

export {
  togglePlaybookRuleAutoApplyHelper,
  rollbackPlaybookRuleHelper,
} from './playbook-rule-helpers';

export async function savePlaybookScheduleHelper(params: {
  ws: string;
  input: {
    blueprintId: string;
    scheduleCron: string;
    batchSize: number;
    isActive: boolean;
  };
  t: PlaybookTranslation;
  setStatusMessage: (msg: StatusMessage | null) => void;
  reload: () => Promise<void>;
}): Promise<void> {
  const { ws, input, t, setStatusMessage, reload } = params;
  const res = await saveRecurringScheduleAction({
    workspaceId: ws,
    blueprintId: input.blueprintId,
    scheduleCron: input.scheduleCron,
    batchSize: input.batchSize,
    isActive: input.isActive,
  });

  if (res.success) {
    setStatusMessage({ type: 'success', text: t('scheduleCreated') });
    void reload();
  } else {
    setStatusMessage({ type: 'error', text: res.error || 'Failed to save schedule' });
  }
}

export async function togglePlaybookScheduleHelper(params: {
  schedule: RecurringCampaignSchedule;
  setData: React.Dispatch<React.SetStateAction<PlaybookOverviewData>>;
  setStatusMessage: (msg: StatusMessage | null) => void;
}): Promise<void> {
  const { schedule, setData, setStatusMessage } = params;
  const nextActive = !schedule.isActive;
  const res = await toggleRecurringScheduleAction(schedule.id, nextActive);

  if (res.success) {
    setData((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) =>
        s.id === schedule.id ? { ...s, isActive: nextActive } : s,
      ),
    }));
  } else {
    setStatusMessage({ type: 'error', text: res.error || 'Failed to toggle schedule' });
  }
}

export async function triggerPlaybookBatchHelper(params: {
  ws: string;
  blueprintId: string;
  batchSize: number;
  t: PlaybookTranslation;
  setIsTriggering: (v: boolean) => void;
  setBatchResult: (res: BatchRunResult | null) => void;
  setStatusMessage: (msg: StatusMessage | null) => void;
  reload: () => Promise<void>;
}): Promise<void> {
  const { ws, blueprintId, batchSize, t, setIsTriggering, setBatchResult, setStatusMessage, reload } = params;
  setIsTriggering(true);
  setBatchResult(null);
  setStatusMessage(null);
  try {
    const res = await triggerBatchRunAction({ workspaceId: ws, blueprintId, batchSize });
    if (!res.success) {
      setStatusMessage({ type: 'error', text: res.error || t('preflightError') });
      return;
    }
    setBatchResult(res.data);
    setStatusMessage({ type: 'success', text: t('batchTriggered') });
    void reload();
  } finally {
    setIsTriggering(false);
  }
}
