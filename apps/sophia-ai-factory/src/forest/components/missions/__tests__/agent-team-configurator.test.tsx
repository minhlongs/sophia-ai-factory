import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AgentTeamConfigurator } from '../agent-team-configurator';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../team-config/use-agent-team', () => ({
  useAgentTeam: () => ({
    agents: [
      {
        id: 'agent-1',
        role: 'researcher',
        name: 'Alpha Researcher',
        model: 'anthropic/claude-3-5-sonnet',
        dailyBudgetCap: 15,
        systemPrompt: 'Scout top trending niches',
        active: true,
      },
    ],
    loading: false,
    saving: false,
    error: null,
    success: null,
    dialogOpen: false,
    setDialogOpen: vi.fn(),
    mode: 'create',
    form: {
      role: 'researcher',
      name: '',
      model: 'anthropic/claude-3-5-sonnet',
      dailyBudgetCap: 10,
      systemPrompt: '',
    },
    setForm: vi.fn(),
    isFormValid: true,
    openCreateDialog: vi.fn(),
    openEditDialog: vi.fn(),
    closeDialog: vi.fn(),
    handleSubmit: vi.fn(),
    handleToggle: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

describe('AgentTeamConfigurator', () => {
  it('renders team configurator view with agent cards', () => {
    render(<AgentTeamConfigurator />);
    expect(screen.getByText('configure_team')).toBeDefined();
    expect(screen.getByText('Alpha Researcher')).toBeDefined();
  });
});
