'use client';

/**
 * Autonomy Mission Type Policy Row & Add Form Subcomponents
 * Layer: components/autonomy
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import type { MissionTypePolicyRow } from './types';

export function MissionPolicyRowItem({
  policy,
  savingType,
  savingLabel,
  onUpdate,
  onSave,
}: {
  policy: MissionTypePolicyRow;
  savingType: string | null;
  savingLabel: string;
  onUpdate: (missionType: string, patch: Partial<MissionTypePolicyRow>) => void;
  onSave: (policy: MissionTypePolicyRow) => void;
}) {
  const t = useTranslations('autonomy');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
      <span className="min-w-24 font-medium text-foreground">{policy.missionType}</span>
      <select
        value={policy.autonomyTier}
        onChange={(e) => onUpdate(policy.missionType, { autonomyTier: Number(e.target.value) })}
        disabled={savingType !== null}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
      >
        {[0, 1, 2, 3].map((tier) => (
          <option key={tier} value={tier}>
            {t(`policyTiers.tier${tier}` as 'policyTiers.tier0')}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={policy.requirePublishApproval}
          onChange={(e) => onUpdate(policy.missionType, { requirePublishApproval: e.target.checked })}
          disabled={savingType !== null}
        />
        {t('approveBeforePublish')}
      </label>
      <button
        type="button"
        onClick={() => onSave(policy)}
        disabled={savingType !== null}
        className="ml-auto rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
      >
        {savingType === policy.missionType ? savingLabel : t('save')}
      </button>
    </div>
  );
}

export function NewMissionPolicyRowInput({
  newMissionType,
  savingType,
  onChange,
  onAddDefault,
}: {
  newMissionType: string;
  savingType: string | null;
  onChange: (value: string) => void;
  onAddDefault: (trimmedMissionType: string) => void;
}) {
  const t = useTranslations('autonomy');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
      <input
        type="text"
        value={newMissionType}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('newMissionPlaceholder')}
        disabled={savingType !== null}
        className="min-w-40 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
      />
      <button
        type="button"
        onClick={() => {
          const trimmed = newMissionType.trim();
          if (!trimmed) return;
          onAddDefault(trimmed);
        }}
        disabled={savingType !== null || newMissionType.trim().length === 0}
        className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
      >
        {t('addDefaultL2')}
      </button>
    </div>
  );
}
