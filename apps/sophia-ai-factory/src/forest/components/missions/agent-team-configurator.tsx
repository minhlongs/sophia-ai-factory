'use client';
/**
 * AgentTeamConfigurator — Client component for managing agent team.
 *
 * Features:
 * - View team agents with status
 * - Add new agent (role, name, system prompt, model)
 * - Edit existing agent
 * - Toggle agent enabled/disabled
 * - Remove agent (guarded: min 1 agent)
 *
 * Calls server actions from @/app/actions/agent-team-config
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Textarea } from '@/seed/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/seed/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/seed/components/ui/dialog';
import { Label } from '@/seed/components/ui/label';
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bot,
  Settings2,
} from 'lucide-react';
import type { Agent } from '@/forest/agents/types';

const AGENT_ROLES = [
  { value: 'CEO', labelKey: 'role_ceo', icon: 'person_pin' },
  { value: 'Developer', labelKey: 'role_developer', icon: 'code' },
  { value: 'QA', labelKey: 'role_qa', icon: 'bug_report' },
  { value: 'Ops', labelKey: 'role_ops', icon: 'settings' },
  { value: 'Marketing', labelKey: 'role_marketing', icon: 'campaign' },
] as const;

const ROLE_ICONS: Record<string, string> = {
  CEO: 'person_pin',
  Developer: 'code',
  QA: 'bug_report',
  Ops: 'settings',
  Marketing: 'campaign',
};

const EMPTY_FORM = {
  role: 'CEO' as Agent['role'],
  name: '',
  systemPrompt: '',
  model: '',
};

type FormState = typeof EMPTY_FORM;
type DialogMode = 'create' | 'edit' | null;

export function AgentTeamConfigurator() {
  const t = useTranslations('dashboard.missions.control');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/team');
      const data = (await res.json()) as { success: boolean; team?: { agents: Agent[] }; error?: string };
      if (data.success) {
        setAgents(data.team?.agents ?? []);
      } else {
        setError(data.error ?? 'Failed to load team');
      }
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
      const endpoint =
        mode === 'create'
          ? '/api/agents/team/create'
          : '/api/agents/team/update';
      const body =
        mode === 'create'
          ? form
          : { agentId: editingAgent!.id, ...form };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; team?: { agents: Agent[] }; error?: string };
      if (data.success) {
        setSuccess(
          mode === 'create'
            ? t('agent_created')
            : t('agent_updated'),
        );
        setAgents(data.team?.agents ?? []);
        closeDialog();
      } else {
        setError(data.error ?? 'Operation failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (agent: Agent) => {
    clearMessages();
    try {
      const res = await fetch('/api/agents/team/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          enabled: !agent.enabled,
        }),
      });
      const data = (await res.json()) as { success: boolean; team?: { agents: Agent[] }; error?: string };
      if (data.success) {
        setAgents(data.team?.agents ?? []);
        setSuccess(
          !agent.enabled ? t('agent_enabled') : t('agent_disabled'),
        );
      } else {
        setError(data.error ?? 'Failed to toggle agent');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(t('delete_confirm', { name: agent.name }))) return;
    clearMessages();
    try {
      const res = await fetch('/api/agents/team/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = (await res.json()) as { success: boolean; team?: { agents: Agent[] }; error?: string };
      if (data.success) {
        setAgents(data.team?.agents ?? []);
        setSuccess(t('agent_deleted'));
      } else {
        setError(data.error ?? 'Failed to delete agent');
      }
    } catch {
      setError('Network error');
    }
  };

  const isFormValid =
    form.name.trim().length > 0 && form.systemPrompt.trim().length >= 10;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            {t('configure_team')}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-1" />
                {t('add_agent')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {mode === 'create'
                    ? t('create_agent_title')
                    : t('edit_agent_title')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('agent_role')}</Label>
                  <Select
                    value={form.role}
                    onValueChange={v =>
                      setForm(f => ({ ...f, role: v as Agent['role'] }))
                    }
                    disabled={mode === 'edit'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_ROLES.map(r => (
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
                    onChange={e =>
                      setForm(f => ({ ...f, name: e.target.value }))
                    }
                    placeholder={t('agent_name_placeholder')}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('system_prompt')}</Label>
                  <Textarea
                    value={form.systemPrompt}
                    onChange={e =>
                      setForm(f => ({ ...f, systemPrompt: e.target.value }))
                    }
                    placeholder={t('system_prompt_placeholder')}
                    rows={6}
                    maxLength={4000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.systemPrompt.length}/4000
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t('model')}</Label>
                  <Input
                    value={form.model}
                    onChange={e =>
                      setForm(f => ({ ...f, model: e.target.value }))
                    }
                    placeholder={t('model_placeholder')}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost" onClick={closeDialog}>
                    {t('cancel')}
                  </Button>
                </DialogClose>
                <Button
                  onClick={handleSubmit}
                  disabled={saving || !isFormValid}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {mode === 'create' ? t('create') : t('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {success && (
          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
            <CheckCircle2 className="w-3 h-3" />
            {success}
          </p>
        )}
        {error && !dialogOpen && (
          <p className="text-xs text-destructive flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('no_agents')}
          </p>
        )}
        {agents.map(agent => (
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
                onClick={() => handleToggle(agent)}
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
                onClick={() => openEditDialog(agent)}
                title={t('edit')}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(agent)}
                disabled={agents.length <= 1}
                title={t('delete')}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
