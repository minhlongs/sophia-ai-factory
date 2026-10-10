'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Plus, Loader2, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react';
import { useAgentTeam } from './use-agent-team';
import { AgentCardItem } from './agent-card-item';
import { AgentDialog } from './agent-dialog';

export function TeamConfiguratorView() {
  const t = useTranslations('dashboard.missions.control');
  const {
    agents,
    loading,
    saving,
    error,
    success,
    dialogOpen,
    setDialogOpen,
    mode,
    form,
    setForm,
    isFormValid,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    handleSubmit,
    handleToggle,
    handleDelete,
  } = useAgentTeam();

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
          <Button size="sm" variant="outline" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-1" />
            {t('add_agent')}
          </Button>
          <AgentDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            mode={mode}
            form={form}
            onFormChange={setForm}
            onClose={closeDialog}
            onSubmit={handleSubmit}
            saving={saving}
            error={error}
            isFormValid={isFormValid}
          />
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
        {agents.map((agent) => (
          <AgentCardItem
            key={agent.id}
            agent={agent}
            onToggle={handleToggle}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            disableDelete={agents.length <= 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}
