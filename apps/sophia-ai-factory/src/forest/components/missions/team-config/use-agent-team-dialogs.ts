'use client';

import { useCallback } from 'react';
import type { Agent } from '@/forest/agents/types';
import { type AgentFormState, type DialogMode, EMPTY_FORM } from './types';

interface UseAgentTeamDialogsInput {
  mode: DialogMode | null;
  setMode: React.Dispatch<React.SetStateAction<DialogMode | null>>;
  editingAgent: Agent | null;
  setEditingAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  dialogOpen: boolean;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearMessages: () => void;
}

export function useAgentTeamDialogs({
  mode,
  setMode,
  editingAgent,
  setEditingAgent,
  form,
  setForm,
  dialogOpen,
  setDialogOpen,
  clearMessages,
}: UseAgentTeamDialogsInput) {
  const openCreateDialog = useCallback(() => {
    setMode('create');
    setEditingAgent(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    clearMessages();
  }, [setMode, setEditingAgent, setForm, setDialogOpen, clearMessages]);

  const openEditDialog = useCallback((agent: Agent) => {
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
  }, [setMode, setEditingAgent, setForm, setDialogOpen, clearMessages]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setMode(null);
    setEditingAgent(null);
    setForm(EMPTY_FORM);
  }, [setDialogOpen, setMode, setEditingAgent, setForm]);

  return {
    openCreateDialog,
    openEditDialog,
    closeDialog,
    dialogOpen,
    mode,
    editingAgent,
    form,
    setForm,
  };
}