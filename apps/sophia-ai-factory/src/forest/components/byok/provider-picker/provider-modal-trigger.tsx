// i18n-namespace: byok.picker
'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PROVIDER_LABELS, type ByokModelOption, type ByokSelection } from './types';

interface ProviderModalTriggerProps {
  open: boolean;
  value?: ByokSelection | null;
  selectedModel?: ByokModelOption;
  onToggle: () => void;
}

export function ProviderModalTrigger({
  open,
  value,
  selectedModel,
  onToggle,
}: ProviderModalTriggerProps) {
  const t = useTranslations('byok.picker');

  const labelText = value
    ? `${PROVIDER_LABELS[value.providerId]} / ${selectedModel?.label ?? value.modelId}`
    : t('placeholder');

  return (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <span className="truncate">{labelText}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
    </button>
  );
}
