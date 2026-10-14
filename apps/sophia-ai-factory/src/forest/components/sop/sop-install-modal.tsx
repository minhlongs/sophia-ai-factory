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
import { Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import type { SopTemplateRow } from '@/seed/sop/sop-types';
import { CRON_PRESETS } from '@/seed/sop/install-input-schema';
import { CategoryBadge } from './category-badge';
import { SopConfigForm, parseConfigSchema } from './sop-config-form';
import {
  SopAdvancedCustomizationSection,
  SopScheduleAndToggleSection,
} from './sop-install-modal-sections';

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
              <Clock className="w-3 h-3" aria-hidden="true" />
              {t('setupTime', { n: setupTime })}
            </span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">{name}</p>
        </DialogHeader>

        <div className="space-y-5">
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

          <SopScheduleAndToggleSection
            selectedPreset={selectedPreset}
            onSelectPreset={setSelectedPreset}
            enabled={enabled}
            onToggleEnabled={() => setEnabled(!enabled)}
            error={error}
          />

          <SopAdvancedCustomizationSection
            advancedOpen={advancedOpen}
            onToggleAdvanced={() => setAdvancedOpen(!advancedOpen)}
            customizations={customizations}
            onChangeCustomizations={setCustomizations}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="bg-primary hover:bg-primary/90">
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
