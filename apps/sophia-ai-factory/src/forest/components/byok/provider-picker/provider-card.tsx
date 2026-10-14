// i18n-namespace: byok.picker
'use client';

import type { ByokModelOption, ByokProviderId, ByokSelection } from './types';

interface ProviderCardProps {
  providerId: ByokProviderId;
  model: ByokModelOption;
  value?: ByokSelection | null;
  onSelect: (providerId: ByokProviderId, modelId: string) => void;
}

export function ProviderCard({
  providerId,
  model,
  value,
  onSelect,
}: ProviderCardProps) {
  const isSelected = value?.providerId === providerId && value.modelId === model.modelId;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => onSelect(providerId, model.modelId)}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted ${
        isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
      }`}
    >
      <span>{model.label}</span>
      <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">
        ${model.inputPer1k}/${model.outputPer1k} /1k
      </span>
    </button>
  );
}
