'use client';

/**
 * Autonomy Settings Mission Type Policy Table
 * Layer: components/autonomy
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { setMissionTypePolicyAction } from '@/land/autonomy/actions';
import { MissionTypePolicyRow } from './types';

export function MissionTypePolicyTable({
  initialPolicies,
  savingLabel,
}: {
  initialPolicies: MissionTypePolicyRow[];
  savingLabel: string;
}) {
  const t = useTranslations('autonomy');
  const [policies, setPolicies] = useState<MissionTypePolicyRow[]>(initialPolicies);
  const [newMissionType, setNewMissionType] = useState('');
  const [savingType, setSavingType] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const handleSavePolicy = async (policy: MissionTypePolicyRow) => {
    setSavingType(policy.missionType);
    setPolicyError(null);
    try {
      const res = await setMissionTypePolicyAction({
        missionType: policy.missionType,
        autonomyTier: policy.autonomyTier,
        requirePublishApproval: policy.requirePublishApproval,
        maxCostCentsPerRun: policy.maxCostCentsPerRun,
        maxAutoRetries: policy.maxAutoRetries,
      });
      if (!res.ok) {
        setPolicyError(res.error.message);
        return;
      }
      setPolicies((prev) => {
        const exists = prev.some((p) => p.missionType === policy.missionType);
        if (exists) {
          return prev.map((p) => (p.missionType === policy.missionType ? policy : p));
        }
        return [...prev, policy].sort((a, b) => a.missionType.localeCompare(b.missionType));
      });
      setNewMissionType('');
    } catch {
      setPolicyError(t('networkError'));
    } finally {
      setSavingType(null);
    }
  };

  const updatePolicy = (missionType: string, patch: Partial<MissionTypePolicyRow>) => {
    setPolicies((prev) => prev.map((p) => (p.missionType === missionType ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <h3 className="text-lg font-semibold text-foreground">
        {t('policiesTitle')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('policiesDescription')}
      </p>

      {policyError && (
        <p className="text-sm text-destructive">{policyError}</p>
      )}

      <div className="space-y-2">
        {policies.map((policy) => (
          <div
            key={policy.missionType}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3"
          >
            <span className="min-w-24 font-medium text-foreground">{policy.missionType}</span>
            <select
              value={policy.autonomyTier}
              onChange={(e) => updatePolicy(policy.missionType, { autonomyTier: Number(e.target.value) })}
              disabled={savingType !== null}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            >
              {[0, 1, 2, 3].map((tier) => (
                <option key={tier} value={tier}>{t(`policyTiers.tier${tier}` as 'policyTiers.tier0')}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={policy.requirePublishApproval}
                onChange={(e) => updatePolicy(policy.missionType, { requirePublishApproval: e.target.checked })}
                disabled={savingType !== null}
              />
              {t('approveBeforePublish')}
            </label>
            <button
              type="button"
              onClick={() => handleSavePolicy(policy)}
              disabled={savingType !== null}
              className="ml-auto rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            >
              {savingType === policy.missionType
                ? savingLabel
                : t('save')}
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
          <input
            type="text"
            value={newMissionType}
            onChange={(e) => setNewMissionType(e.target.value)}
            placeholder={t('newMissionPlaceholder')}
            disabled={savingType !== null}
            className="min-w-40 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = newMissionType.trim();
              if (!trimmed) return;
              void handleSavePolicy({
                missionType: trimmed,
                autonomyTier: 2,
                requirePublishApproval: true,
                maxCostCentsPerRun: null,
                maxAutoRetries: 3,
              });
            }}
            disabled={savingType !== null || newMissionType.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            {t('addDefaultL2')}
          </button>
        </div>
      </div>
    </div>
  );
}
