'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings2, Shield, Zap } from 'lucide-react';

export function AutonomySettings({
  initialLevel,
  onLevelChange,
}: {
  initialLevel: number;
  onLevelChange?: (level: number) => void;
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
    </div>
  );
}