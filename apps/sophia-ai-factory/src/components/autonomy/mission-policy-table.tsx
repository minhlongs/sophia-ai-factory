'use client';

/**
 * Autonomy Settings Mission Type Policy Table
 * Layer: components/autonomy
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { setMissionTypePolicyAction } from '@/land/autonomy/actions';
import { MissionTypePolicyRow } from './types';
import {
  MissionPolicyRowItem,
  NewMissionPolicyRowInput,
} from './mission-policy-row-items';

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
          <MissionPolicyRowItem
            key={policy.missionType}
            policy={policy}
            savingType={savingType}
            savingLabel={savingLabel}
            onUpdate={updatePolicy}
            onSave={(p) => {
              void handleSavePolicy(p);
            }}
          />
        ))}

        <NewMissionPolicyRowInput
          newMissionType={newMissionType}
          savingType={savingType}
          onChange={setNewMissionType}
          onAddDefault={(trimmed) => {
            void handleSavePolicy({
              missionType: trimmed,
              autonomyTier: 2,
              requirePublishApproval: true,
              maxCostCentsPerRun: null,
              maxAutoRetries: 3,
            });
          }}
        />
      </div>
    </div>
  );
}
