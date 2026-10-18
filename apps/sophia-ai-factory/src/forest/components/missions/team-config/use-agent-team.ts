'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Agent } from '@/forest/agents/types';
import { type AgentFormState, type DialogMode, EMPTY_FORM } from './types';
import {
  fetchAgentTeamRequest,
  submitAgentTeamFormRequest,
  toggleAgentTeamMemberRequest,
  deleteAgentTeamMemberRequest,
} from './agent-team-api';

export * from './agent-team-api';

export function useAgentTeam() {
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

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAgentTeamRequest();
      if (data.success) setAgents(data.team?.agents ?? []);
      else setError(data.error ?? 'Failed to load team');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const openCreateDialog = () => {
    setMode('create');
    setEditingAgent(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    clearMessages();
  };

  const openEditDialog = (agent: Agent) => {
    setMode('edit');
    setEditingAgent(agent);
    setForm({
      role: agent.role,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      model: agent.model ?? '',
    });
    setDialogOpen(true);
    clearMessages();
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setMode(null);
    setEditingAgent(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    setSaving(true);
    clearMessages();
    try {
      const data = await submitAgentTeamFormRequest(mode, form, editingAgent?.id);
      if (data.success) {
        setSuccess(mode === 'create' ? t('agent_created') : t('agent_updated'));
        setAgents(data.team?.agents ?? []);
        closeDialog();
      } else setError(data.error ?? 'Operation failed');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (agent: Agent) => {
    clearMessages();
    try {
      const data = await toggleAgentTeamMemberRequest(agent.id, !agent.enabled);
      if (data.success) {
        setAgents(data.team?.agents ?? []);
        setSuccess(!agent.enabled ? t('agent_enabled') : t('agent_disabled'));
      } else setError(data.error ?? 'Failed to toggle agent');
    } catch {
      setError('Network error');
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(t('delete_confirm', { name: agent.name }))) return;
    clearMessages();
    try {
      const data = await deleteAgentTeamMemberRequest(agent.id);
      if (data.success) {
        setAgents(data.team?.agents ?? []);
        setSuccess(t('agent_deleted'));
      } else setError(data.error ?? 'Failed to delete agent');
    } catch {
      setError('Network error');
    }
  };

  const isFormValid = form.name.trim().length > 0 && form.systemPrompt.trim().length >= 10;

  return {
    agents, loading, saving, error, success,
    dialogOpen, setDialogOpen, mode, form, setForm, isFormValid,
    openCreateDialog, openEditDialog, closeDialog,
    handleSubmit, handleToggle, handleDelete,
  };
}
