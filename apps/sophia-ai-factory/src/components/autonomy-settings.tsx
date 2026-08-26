'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings2, Shield, Zap } from 'lucide-react';
import { setMissionTypePolicyAction } from '@/land/autonomy/actions';

/** Serializable per-mission-type policy row passed from the server page. */
export interface MissionTypePolicyRow {
  missionType: string;
  autonomyTier: number;
  requirePublishApproval: boolean;
  maxCostCentsPerRun: number | null;
  maxAutoRetries: number;
}

const TIER_LABELS: Record<'vi' | 'en', string[]> = {
  vi: ['L0 Thủ công', 'L1 Hỗ trợ', 'L2 Giám sát', 'L3 Tự động hoàn toàn'],
  en: ['L0 Manual', 'L1 Assisted', 'L2 Supervised', 'L3 Full auto'],
};

function tierLabel(locale: 'vi' | 'en', idx: number): string {
  return TIER_LABELS[locale][idx] ?? `L${idx}`;
}

/**
 * Per-mission-type autonomy policy table. Owns its own edit/save state and
 * persists through the setMissionTypePolicyAction server action.
 */
function MissionTypePolicyTable({
  initialPolicies,
  locale,
  savingLabel,
}: {
  initialPolicies: MissionTypePolicyRow[];
  locale: 'vi' | 'en';
  savingLabel: string;
}) {
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
      setPolicyError(locale === 'vi' ? 'Lỗi mạng, vui lòng thử lại' : 'Network error, please retry');
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
        {locale === 'vi' ? 'Chính sách theo loại mission' : 'Per-mission-type policies'}
      </h3>
      <p className="text-sm text-muted-foreground">
        {locale === 'vi'
          ? 'Đặt cấp độ tự chủ riêng cho từng loại mission. Mặc định L2: agent chạy, cần duyệt trước khi đăng.'
          : 'Set an autonomy tier per mission type. Default L2: agents run, publish requires approval.'}
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
                <option key={tier} value={tier}>{tierLabel(locale, tier)}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={policy.requirePublishApproval}
                onChange={(e) => updatePolicy(policy.missionType, { requirePublishApproval: e.target.checked })}
                disabled={savingType !== null}
              />
              {locale === 'vi' ? 'Duyệt trước khi đăng' : 'Approve before publish'}
            </label>
            <button
              type="button"
              onClick={() => handleSavePolicy(policy)}
              disabled={savingType !== null}
              className="ml-auto rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            >
              {savingType === policy.missionType
                ? savingLabel
                : locale === 'vi' ? 'Lưu' : 'Save'}
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
          <input
            type="text"
            value={newMissionType}
            onChange={(e) => setNewMissionType(e.target.value)}
            placeholder={locale === 'vi' ? 'Loại mission mới (vd: article)' : 'New mission type (e.g. article)'}
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
            {locale === 'vi' ? 'Thêm (L2 mặc định)' : 'Add (default L2)'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AutonomySettings({
  initialLevel,
  onLevelChange,
  initialPolicies,
}: {
  initialLevel: number;
  onLevelChange?: (level: number) => void;
  initialPolicies?: MissionTypePolicyRow[];
}) {
  const t = useTranslations('autonomy');
  const locale = (t('levels.level0Description') as string).length > 20 ? 'vi' : 'en';
  const [level, setLevel] = useState<number>(initialLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (newLevel: number) => {
    setSaving(true);
    setError(null);
    setLevel(newLevel);
    onLevelChange?.(newLevel);
    try {
      const res = await fetch('/api/autonomy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: newLevel }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        setError((body.error as string) ?? `HTTP ${res.status}`);
      }
    } catch {
      setError(locale === 'vi' ? 'Lỗi mạng, vui lòng thử lại' : 'Network error, please retry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">
          {t('title')}
        </h2>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('description')}
      </p>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, idx) => {
          const isActive = level === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleChange(idx)}
              disabled={saving}
              className={[
                'flex items-start gap-3 rounded-lg border p-4 text-left transition',
                isActive
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                  : 'border-border bg-background hover:border-primary/60',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {idx}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {idx === 0 && <Shield className="h-4 w-4 text-primary" />}
                  {idx >= 3 && <Zap className="h-4 w-4 text-primary" />}
                  <span className="font-medium text-foreground">
                    {t(`levels.level${idx}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`levels.level${idx}Description`)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground">
          {t('saving')}
        </p>
      )}

      {initialPolicies !== undefined && (
        <MissionTypePolicyTable
          initialPolicies={initialPolicies}
          locale={locale}
          savingLabel={t('saving') as string}
        />
      )}
    </div>
  );
}
