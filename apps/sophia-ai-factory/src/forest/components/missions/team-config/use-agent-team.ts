'use client';

import { useEffect } from 'react';
import { useAgentTeamState } from './use-agent-team-state';
import { useAgentTeamFetch } from './use-agent-team-fetch';
import { useAgentTeamMutations } from './use-agent-team-mutations';
import { useAgentTeamDialogs } from './use-agent-team-dialogs';

export * from './agent-team-api';

export function useAgentTeam() {
  const state = useAgentTeamState();
  const fetchTeam = useAgentTeamFetch(state);
  const mutations = useAgentTeamMutations(state);
  const dialogs = useAgentTeamDialogs({
    ...state,
    ...mutations,
  });

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  const isFormValid = state.form.name.trim().length > 0 && state.form.systemPrompt.trim().length >= 10;

  return {
    ...state,
    ...mutations,
    ...dialogs,
    fetchTeam,
    isFormValid,
  };
}