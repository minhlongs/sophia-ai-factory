// i18n-namespace: dashboard.playbook
import {
  toggleRuleAutoApplyAction,
  rollbackRuleAction,
  type PlaybookOverviewData,
} from '@/land/playbook/actions';
import type { PlaybookRule } from '@/seed/types/playbook-pattern';
import type { StatusMessage, PlaybookTranslation } from './types';

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
