'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/seed/components/ui/dialog';
import { Loader2, AlertCircle } from 'lucide-react';
import type { AgentFormState, DialogMode } from './types';
import { PersonaSelector } from './persona-selector';
import { BudgetAllocator } from './budget-allocator';

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  form: AgentFormState;
  onFormChange: React.Dispatch<React.SetStateAction<AgentFormState>>;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  saving: boolean;
  error: string | null;
  isFormValid: boolean;
}

export function AgentDialog({
  open,
  onOpenChange,
  mode,
  form,
  onFormChange,
  onClose,
  onSubmit,
  saving,
  error,
  isFormValid,
}: AgentDialogProps) {
  const t = useTranslations('dashboard.missions.control');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('create_agent_title') : t('edit_agent_title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <PersonaSelector form={form} onChange={onFormChange} mode={mode} />
          <BudgetAllocator form={form} onChange={onFormChange} />
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button onClick={onSubmit} disabled={saving || !isFormValid}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {mode === 'create' ? t('create') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
