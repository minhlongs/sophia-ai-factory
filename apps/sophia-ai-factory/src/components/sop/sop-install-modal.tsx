'use client';

/**
 * SopInstallModal — dialog to configure and install a SOP template.
 *
 * Schedule preset chips (4 options) + enabled toggle.
 * Submits via Server Action installSopAction.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SopTemplateRow } from '@/lib/sop/sop-types';
import { CRON_PRESETS } from '@/lib/sop/install-input-schema';
import { CategoryBadge } from './category-badge';

interface Preset {
  key: keyof typeof CRON_PRESETS;
  labelKey: 'scheduleHourly' | 'scheduleDaily' | 'scheduleWeekly' | 'scheduleManual';
}

const PRESETS: Preset[] = [
  { key: 'manual', labelKey: 'scheduleManual' },
  { key: 'hourly', labelKey: 'scheduleHourly' },
  { key: 'daily9am', labelKey: 'scheduleDaily' },
  { key: 'weeklyMon9am', labelKey: 'scheduleWeekly' },
];

interface SopInstallModalProps {
  template: SopTemplateRow | null;
  locale: string;
  open: boolean;
  onClose: () => void;
  installAction: (formData: FormData) => Promise<{ error?: string }>;
}

export function SopInstallModal({ template, locale, open, onClose, installAction }: SopInstallModalProps) {
  const t = useTranslations('sop.install');
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof CRON_PRESETS>('manual');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!template) return null;

  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    fd.set('slug', template!.slug);
    const cronValue = CRON_PRESETS[selectedPreset];
    if (cronValue) fd.set('scheduleCron', cronValue);
    fd.set('enabled', String(enabled));

    startTransition(async () => {
      const result = await installAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('title')}
            <CategoryBadge category={template.category} />
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">{name}</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Schedule presets */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">{t('schedule')}</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPreset(p.key)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedPreset === p.key
                      ? 'border-violet-500 bg-violet-900/40 text-violet-200'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-foreground">{t('enable')}</span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="bg-violet-700 hover:bg-violet-600">
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
