// i18n-namespace: dashboard.playbook
import {
  toggleRuleAutoApplyAction,
  rollbackRuleAction,
  saveRecurringScheduleAction,
  toggleRecurringScheduleAction,
  triggerBatchRunAction,
  type PlaybookOverviewData,
} from '@/land/playbook/actions';
import type { PlaybookRule, RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { StatusMessage, BatchRunResult, PlaybookTranslation } from './types';

export async function togglePlaybookRuleAutoApplyHelper(params: {
  rule: PlaybookRule;
  t: PlaybookTranslation;
  setData: React.Dispatch<React.SetStateAction<PlaybookOverviewData>>;
  setStatusMessage: (msg: StatusMessage | null) => void;
  reload: () => Promise<void>;
}): Promise<void> {
  const { rule, t, setData, setStatusMessage, reload } = params;
  const nextEnabled = !rule.autoApply;
  setStatusMessage(null);
  const res = await toggleRuleAutoApplyAction(rule.id, nextEnabled, rule.updatedAt);
  if (!res.success) {
    if (res.code === 'CAS_CONFLICT') {
      setStatusMessage({ type: 'error', text: t('casConflict') });
      void reload();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Update failed' });
    }
    return;
  }
  setData((prev) => ({
    ...prev,
    rules: prev.rules.map((r) =>
      r.id === rule.id ? { ...r, autoApply: nextEnabled, updatedAt: res.data.updatedAt } : r,
    ),
  }));
  setStatusMessage({ type: 'success', text: t('ruleUpdated') });
}

export async function rollbackPlaybookRuleHelper(params: {
  rule: PlaybookRule;
  t: PlaybookTranslation;
  setData: React.Dispatch<React.SetStateAction<PlaybookOverviewData>>;
  setStatusMessage: (msg: StatusMessage | null) => void;
}): Promise<void> {
  const { rule, t, setData, setStatusMessage } = params;
  setStatusMessage(null);
  const res = await rollbackRuleAction(rule.id);
  if (!res.success) {
    setStatusMessage({ type: 'error', text: res.error || 'Rollback failed' });
    return;
  }
  setData((prev) => ({
    ...prev,
    rules: prev.rules.map((r) =>
      r.id === rule.id ? { ...r, autoApply: false, rollbackCount: res.data.rollbackCount } : r,
    ),
  }));
  setStatusMessage({ type: 'success', text: t('ruleRolledBack') });
}

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
