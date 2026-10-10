'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/seed/components/ui/label';
import { Input } from '@/seed/components/ui/input';
import { DollarSign } from 'lucide-react';
import type { AgentFormState } from './types';

interface BudgetAllocatorProps {
  form: AgentFormState;
  onChange: React.Dispatch<React.SetStateAction<AgentFormState>>;
}

export function BudgetAllocator({ form, onChange }: BudgetAllocatorProps) {
  const t = useTranslations('dashboard.missions.control');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('model')}</Label>
        <Input
          value={form.model}
          onChange={(e) =>
            onChange((f) => ({ ...f, model: e.target.value }))
          }
          placeholder={t('model_placeholder')}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DollarSign className="w-3.5 h-3.5 text-primary" />
          <span>Max Daily Budget Cap ($ USD)</span>
        </Label>
        <Input
          type="number"
          min={1}
          max={500}
          value={form.budgetCapUsd ?? 10}
          onChange={(e) =>
            onChange((f) => ({
              ...f,
              budgetCapUsd: parseFloat(e.target.value) || 0,
            }))
          }
          placeholder="10"
        />
        <p className="text-[11px] text-muted-foreground">
          Autonomous spend guard for OpenRouter LLM inference calls.
        </p>
      </div>
    </div>
  );
}
