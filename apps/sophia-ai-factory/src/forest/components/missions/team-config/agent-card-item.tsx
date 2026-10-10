'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { Pencil, Trash2, Power } from 'lucide-react';
import type { Agent } from '@/forest/agents/types';
import { ROLE_ICONS } from './types';

interface AgentCardItemProps {
  agent: Agent;
  onToggle: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  disableDelete: boolean;
}

export function AgentCardItem({
  agent,
  onToggle,
  onEdit,
  onDelete,
  disableDelete,
}: AgentCardItemProps) {
  const t = useTranslations('dashboard.missions.control');

  return (
    <div
      key={agent.id}
      className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border"
    >
      <span className="material-symbols-outlined text-lg text-muted-foreground mt-0.5">
        {ROLE_ICONS[agent.role] ?? 'smart_toy'}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{agent.name}</span>
          <Badge variant={agent.enabled ? 'default' : 'secondary'} className="text-xs">
            {agent.role}
          </Badge>
          {agent.model && (
            <Badge variant="outline" className="text-xs">
              {agent.model}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {agent.systemPrompt.slice(0, 120)}
          {agent.systemPrompt.length > 120 && '...'}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onToggle(agent)}
          title={agent.enabled ? t('agent_disabled') : t('agent_enabled')}
        >
          <Power
            className={`w-4 h-4 ${
              agent.enabled ? 'text-emerald-600' : 'text-muted-foreground'
            }`}
          />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onEdit(agent)}
          title={t('edit')}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(agent)}
          disabled={disableDelete}
          title={t('delete')}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
