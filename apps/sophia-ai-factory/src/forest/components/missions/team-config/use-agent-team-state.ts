'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Agent } from '@/forest/agents/types';
import { type AgentFormState, type DialogMode, EMPTY_FORM } from './types';

export function useAgentTeamState() {
  const t = useTranslations('dashboard.missions.control');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);

  return {
    t,
    agents, setAgents, loading, setLoading, saving, setSaving,
    error, setError, success, setSuccess,
    dialogOpen, setDialogOpen, mode, setMode,
    editingAgent, setEditingAgent, form, setForm,
  };
}