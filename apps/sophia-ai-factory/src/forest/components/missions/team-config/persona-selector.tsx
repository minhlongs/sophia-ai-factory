'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/seed/components/ui/label';
import { Input } from '@/seed/components/ui/input';
import { Textarea } from '@/seed/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import type { Agent } from '@/forest/agents/types';
import { AGENT_ROLES, type AgentFormState, type DialogMode } from './types';

interface PersonaSelectorProps {
  form: AgentFormState;
  onChange: React.Dispatch<React.SetStateAction<AgentFormState>>;
  mode: DialogMode;
}

export function PersonaSelector({ form, onChange, mode }: PersonaSelectorProps) {
  const t = useTranslations('dashboard.missions.control');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('agent_role')}</Label>
        <Select
          value={form.role}
          onValueChange={(v) =>
            onChange((f) => ({ ...f, role: v as Agent['role'] }))
          }
          disabled={mode === 'edit'}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {t(r.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('agent_name')}</Label>
        <Input
          value={form.name}
          onChange={(e) =>
            onChange((f) => ({ ...f, name: e.target.value }))
          }
          placeholder={t('agent_name_placeholder')}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('system_prompt')}</Label>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) =>
            onChange((f) => ({ ...f, systemPrompt: e.target.value }))
          }
          placeholder={t('system_prompt_placeholder')}
          rows={5}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground">
          {form.systemPrompt.length}/4000
        </p>
      </div>
    </div>
  );
}
