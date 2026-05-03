'use client';

/**
 * SopInstallModal — no-code form-based SOP installation dialog.
 *
 * Primary view: config form rendered from template.config_schema.
 * Advanced section (collapsed): Markdown override textarea.
 * Schedule presets + enabled toggle preserved from Phase 1.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import type { SopTemplateRow } from '@/lib/sop/sop-types';
import { CRON_PRESETS } from '@/lib/sop/install-input-schema';
import { CategoryBadge } from './category-badge';
import { SopConfigForm, parseConfigSchema } from './sop-config-form';

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
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customizations, setCustomizations] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!template) return null;

  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;

  const { schema, defaults } = parseConfigSchema(template.config_schema, template.config_defaults);

  // Initialize config values with defaults when template changes
  function getEffectiveValues() {
    return { ...defaults, ...configValues };
  }

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    fd.set('slug', template!.slug);
    const cronValue = CRON_PRESETS[selectedPreset];
    if (cronValue) fd.set('scheduleCron', cronValue);
    fd.set('enabled', String(enabled));
    fd.set('configValues', JSON.stringify(getEffectiveValues()));
    if (customizations.trim()) fd.set('customizations', customizations.trim());

    startTransition(async () => {
      const result = await installAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  const hasConfigSchema = schema && schema.properties && Object.keys(schema.properties).length > 0;
  const setupTime = template.setup_time_minutes ?? 5;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {t('title')}
            <CategoryBadge category={template.category} />
            <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal ml-auto">
              <Clock className="w-3 h-3" />
              {t('setupTime', { n: setupTime })}
            </span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">{name}</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Config form — primary no-code input */}
          {hasConfigSchema && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">{t('configureTitle')}</p>
              <SopConfigForm
                schema={schema}
                values={getEffectiveValues()}
                onChange={setConfigValues}
              />
            </div>
          )}

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

          {/* Advanced section — Markdown override */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <span>{t('advancedLabel')}</span>
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {advancedOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">{t('advancedHelp')}</p>
                <textarea
                  value={customizations}
                  onChange={(e) => setCustomizations(e.target.value)}
                  placeholder={t('customizationsPlaceholder')}
                  rows={6}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                />
              </div>
            )}
          </div>
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
