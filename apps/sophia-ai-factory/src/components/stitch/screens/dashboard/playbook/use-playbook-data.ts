// i18n-namespace: dashboard.playbook
import { useState, useEffect } from 'react';
import {
  getPlaybookOverviewAction,
  toggleRuleAutoApplyAction,
  rollbackRuleAction,
  saveRecurringScheduleAction,
  toggleRecurringScheduleAction,
  triggerBatchRunAction,
  type PlaybookOverviewData,
} from '@/land/playbook/actions';
import type { PlaybookRule, RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { StatusMessage, BatchRunResult, PlaybookTranslation } from './types';

export function usePlaybookData(
  userId: string,
  workspaceId: string,
  initialData: PlaybookOverviewData | null | undefined,
  t: PlaybookTranslation,
) {
  const [data, setData] = useState<PlaybookOverviewData>({
    patterns: initialData?.patterns ?? [],
    rules: initialData?.rules ?? [],
    blueprints: initialData?.blueprints ?? [],
    schedules: initialData?.schedules ?? [],
  });

  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchRunResult | null>(null);

  const loadData = async () => {
    const ws = workspaceId || userId;
    if (!ws) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPlaybookOverviewAction(ws);
      if (!res.success) {
        setError(res.error || 'Failed to fetch playbook overview');
      } else {
        setData(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching playbook data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [workspaceId, userId]);

  const handleToggleAutoApply = async (rule: PlaybookRule) => {
    const nextEnabled = !rule.autoApply;
    setStatusMessage(null);

    const res = await toggleRuleAutoApplyAction(rule.id, nextEnabled, rule.updatedAt);

    if (!res.success) {
      if (res.code === 'CAS_CONFLICT') {
        setStatusMessage({ type: 'error', text: t('casConflict') });
        void loadData();
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Update failed' });
      }
      return;
    }

    setData((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === rule.id
          ? { ...r, autoApply: nextEnabled, updatedAt: res.data.updatedAt }
          : r,
      ),
    }));
    setStatusMessage({ type: 'success', text: t('ruleUpdated') });
  };

  const handleRollback = async (rule: PlaybookRule) => {
    setStatusMessage(null);
    const res = await rollbackRuleAction(rule.id);

    if (!res.success) {
      setStatusMessage({ type: 'error', text: res.error || 'Rollback failed' });
      return;
    }

    setData((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === rule.id
          ? {
              ...r,
              autoApply: false,
              rollbackCount: res.data.rollbackCount,
            }
          : r,
      ),
    }));
    setStatusMessage({ type: 'success', text: t('ruleRolledBack') });
  };

  const handleSaveSchedule = async (params: {
    blueprintId: string;
    scheduleCron: string;
    batchSize: number;
    isActive: boolean;
  }) => {
    const ws = workspaceId || userId;
    const res = await saveRecurringScheduleAction({
      workspaceId: ws,
      blueprintId: params.blueprintId,
      scheduleCron: params.scheduleCron,
      batchSize: params.batchSize,
      isActive: params.isActive,
    });

    if (res.success) {
      setStatusMessage({ type: 'success', text: t('scheduleCreated') });
      void loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to save schedule' });
    }
  };

  const handleToggleSchedule = async (schedule: RecurringCampaignSchedule) => {
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
  };

  const handleTriggerBatch = async (blueprintId: string, batchSize: number) => {
    setIsTriggering(true);
    setBatchResult(null);
    setStatusMessage(null);

    try {
      const ws = workspaceId || userId;
      const res = await triggerBatchRunAction({
        workspaceId: ws,
        blueprintId,
        batchSize,
      });

      if (!res.success) {
        setStatusMessage({
          type: 'error',
          text: res.error || t('preflightError'),
        });
        return;
      }

      setBatchResult(res.data);
      setStatusMessage({ type: 'success', text: t('batchTriggered') });
      void loadData();
    } finally {
      setIsTriggering(false);
    }
  };

  return {
    data,
    loading,
    error,
    statusMessage,
    isTriggering,
    batchResult,
    loadData,
    handleToggleAutoApply,
    handleRollback,
    handleSaveSchedule,
    handleToggleSchedule,
    handleTriggerBatch,
  };
}
