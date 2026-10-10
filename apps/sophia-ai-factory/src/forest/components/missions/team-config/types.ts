import type { Agent } from '@/forest/agents/types';

export const AGENT_ROLES = [
  { value: 'CEO', labelKey: 'role_ceo', icon: 'person_pin' },
  { value: 'Developer', labelKey: 'role_developer', icon: 'code' },
  { value: 'QA', labelKey: 'role_qa', icon: 'bug_report' },
  { value: 'Ops', labelKey: 'role_ops', icon: 'settings' },
  { value: 'Marketing', labelKey: 'role_marketing', icon: 'campaign' },
] as const;

export const ROLE_ICONS: Record<string, string> = {
  CEO: 'person_pin',
  Developer: 'code',
  QA: 'bug_report',
  Ops: 'settings',
  Marketing: 'campaign',
};

export interface AgentFormState {
  role: Agent['role'];
  name: string;
  systemPrompt: string;
  model: string;
  budgetCapUsd?: number;
}

export const EMPTY_FORM: AgentFormState = {
  role: 'CEO',
  name: '',
  systemPrompt: '',
  model: '',
  budgetCapUsd: 10,
};

export type DialogMode = 'create' | 'edit' | null;
