// i18n-namespace: dashboard.missions.control
'use client';

import { useCallback } from 'react';
import type { Agent } from '@/forest/agents/types';
import { type AgentFormState, type DialogMode, EMPTY_FORM } from './types';
import {
  submitAgentTeamFormRequest,
  toggleAgentTeamMemberRequest,
  deleteAgentTeamMemberRequest,
} from './agent-team-api';

interface UseAgentTeamMutationsInput {
  t: ReturnType<typeof import('next-intl').useTranslations>;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>;
  mode: DialogMode | null;
  setMode: React.Dispatch<React.SetStateAction<DialogMode | null>>;
  editingAgent: Agent | null;
  setEditingAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAgentTeamMutations({
  t,
  setAgents,
  setSaving,
  setError,
  setSuccess,
  mode,
  setMode,
  editingAgent,
  setEditingAgent,
  form,
  setForm,
  setDialogOpen,
}: UseAgentTeamMutationsInput) {
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, [setError, setSuccess]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    clearMessages();
    try {
      const data = await submitAgentTeamFormRequest(mode, form, editingAgent?.id);
      if (data.success) {
        setSuccess(mode === 'create' ? t('agent_created') : t('agent_updated'));
        setAgents(data.team?.agents ?? []);
        setDialogOpen(false);
        setMode(null);
        setEditingAgent(null);
        setForm(EMPTY_FORM);
      } else setError(data.error ?? 'Operation failed');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }, [
    t, mode, form, editingAgent, setSaving, setSuccess, setAgents, setError,
    setDialogOpen, setMode, setEditingAgent, setForm, clearMessages,
  ]);

  const handleToggle = useCallback(async (agent: Agent) => {
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
  }, [t, setAgents, setSuccess, setError, clearMessages]);

  const handleDelete = useCallback(async (agent: Agent) => {
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
  }, [t, setAgents, setSuccess, setError, clearMessages]);

  return {
    clearMessages,
    handleSubmit,
    handleToggle,
    handleDelete,
  };
}