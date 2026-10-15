// i18n-namespace: dashboard.playbook
import { useState, useEffect, useCallback } from 'react';
import {
  getPlaybookOverviewAction,
  type PlaybookOverviewData,
} from '@/land/playbook/actions';
import type { PlaybookRule, RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { StatusMessage, BatchRunResult, PlaybookTranslation } from './types';
import {
  togglePlaybookRuleAutoApplyHelper,
  rollbackPlaybookRuleHelper,
  savePlaybookScheduleHelper,
  togglePlaybookScheduleHelper,
  triggerPlaybookBatchHelper,
} from './playbook-schedule-helpers';

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

  const loadData = useCallback(async () => {
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
  }, [workspaceId, userId]);

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [initialData, loadData]);

  const handleToggleAutoApply = async (rule: PlaybookRule) => {
    await togglePlaybookRuleAutoApplyHelper({
      rule,
      t,
      setData,
      setStatusMessage,
      reload: loadData,
    });
  };

  const handleRollback = async (rule: PlaybookRule) => {
    await rollbackPlaybookRuleHelper({ rule, t, setData, setStatusMessage });
  };

  const handleSaveSchedule = async (params: {
    blueprintId: string;
    scheduleCron: string;
    batchSize: number;
    isActive: boolean;
  }) => {
    await savePlaybookScheduleHelper({
      ws: workspaceId || userId,
      input: params,
      t,
      setStatusMessage,
      reload: loadData,
    });
  };

  const handleToggleSchedule = async (schedule: RecurringCampaignSchedule) => {
    await togglePlaybookScheduleHelper({ schedule, setData, setStatusMessage });
  };

  const handleTriggerBatch = async (blueprintId: string, batchSize: number) => {
    await triggerPlaybookBatchHelper({
      ws: workspaceId || userId,
      blueprintId,
      batchSize,
      t,
      setIsTriggering,
      setBatchResult,
      setStatusMessage,
      reload: loadData,
    });
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
