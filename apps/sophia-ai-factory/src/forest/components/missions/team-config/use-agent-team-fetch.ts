'use client';

import { useCallback } from 'react';
import type { Agent } from '@/forest/agents/types';
import { fetchAgentTeamRequest } from './agent-team-api';

interface UseAgentTeamFetchInput {
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAgentTeamFetch({
  setAgents,
  setLoading,
  setError,
}: UseAgentTeamFetchInput) {
  return useCallback(async () => {
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
  }, [setAgents, setLoading, setError]);
}