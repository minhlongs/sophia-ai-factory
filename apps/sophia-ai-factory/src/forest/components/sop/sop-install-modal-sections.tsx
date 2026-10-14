'use client';
// i18n-namespace: sop.install

/**
 * SopInstallModal subcomponents — schedule presets, enable toggle, and advanced customization section.
 */

import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CRON_PRESETS } from '@/seed/sop/install-input-schema';

interface Preset {
  key: keyof typeof CRON_PRESETS;
  labelKey: 'scheduleHourly' | 'scheduleDaily' | 'scheduleWeekly' | 'scheduleManual';
}

export const PRESETS: Preset[] = [
  { key: 'manual', labelKey: 'scheduleManual' },
  { key: 'hourly', labelKey: 'scheduleHourly' },
  { key: 'daily9am', labelKey: 'scheduleDaily' },
  { key: 'weeklyMon9am', labelKey: 'scheduleWeekly' },
];

export interface SopScheduleAndToggleSectionProps {
  selectedPreset: keyof typeof CRON_PRESETS;
  onSelectPreset: (preset: keyof typeof CRON_PRESETS) => void;
  enabled: boolean;
  onToggleEnabled: () => void;
  error: string | null;
}

export function SopScheduleAndToggleSection({
  selectedPreset,
  onSelectPreset,
  enabled,
  onToggleEnabled,
  error,
}: SopScheduleAndToggleSectionProps) {
  const t = useTranslations('sop.install');

  return (
    <>
      {/* Schedule presets */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{t('schedule')}</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelectPreset(p.key)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                selectedPreset === p.key
                  ? 'border-primary bg-primary/20 text-primary'
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
          onClick={onToggleEnabled}
          className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background rounded-full shadow transition-transform ${
              enabled ? 'translate-x-5' : ''
            }`}
          />
        </div>
        <span className="text-sm text-foreground">{t('enable')}</span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </>
  );
}

export interface SopAdvancedCustomizationSectionProps {
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  customizations: string;
  onChangeCustomizations: (value: string) => void;
}

export function SopAdvancedCustomizationSection({
  advancedOpen,
  onToggleAdvanced,
  customizations,
  onChangeCustomizations,
}: SopAdvancedCustomizationSectionProps) {
  const t = useTranslations('sop.install');

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <span>{t('advancedLabel')}</span>
        {advancedOpen ? (
          <ChevronUp className="w-4 h-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
      {advancedOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">{t('advancedHelp')}</p>
          <textarea
            value={customizations}
            onChange={(e) => onChangeCustomizations(e.target.value)}
            placeholder={t('customizationsPlaceholder')}
            rows={6}
            className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      )}
    </div>
  );
}
