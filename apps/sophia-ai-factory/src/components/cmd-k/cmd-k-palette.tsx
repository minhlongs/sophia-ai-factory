/**
 * CmdK Palette — global command palette triggered by Cmd+K / Ctrl+K
 *
 * Wraps shadcn/ui CommandDialog (backed by cmdk lib).
 * Sources: page navigation, SOP runs, recent missions, admin actions (role-gated).
 * Recent commands stored in localStorage (last 5).
 *
 * @module components/cmd-k/cmd-k-palette
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useCmdKActions } from './use-cmd-k-actions';
import type { ActionGroup } from './cmd-k-action-types';
import { toast } from 'sonner';

const RECENT_KEY = 'sophia.cmdK.recent';
const MAX_RECENT = 5;

interface CmdKPaletteProps {
  isAdmin: boolean;
}

type GroupLabel = Record<ActionGroup, string>;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  try {
    const prev = loadRecent().filter((r) => r !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

export function CmdKPalette({ isAdmin }: CmdKPaletteProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('cmdK');

  const handleRunSop = useCallback(async (installationId: string, sopName: string) => {
    setOpen(false);
    try {
      const res = await fetch(`/api/v1/sop/installations/${installationId}/run`, { method: 'POST' });
      if (res.ok) {
        toast.success(`Running ${sopName}`, { description: 'Check Missions for progress.' });
      } else {
        toast.error('Run failed');
      }
    } catch {
      toast.error('Network error');
    }
  }, []);

  const actions = useCmdKActions({ isAdmin, open, onRunSop: handleRunSop });

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const groupLabels: GroupLabel = {
    pages: t('groups.pages'),
    sops: t('groups.sops'),
    missions: t('groups.missions'),
    admin: t('groups.admin'),
  };

  const groups: ActionGroup[] = isAdmin
    ? ['pages', 'sops', 'missions', 'admin']
    : ['pages', 'sops', 'missions'];

  const handleSelect = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    saveRecent(actionId);
    setOpen(false);
    action.onSelect();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('placeholder')} />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>
        {groups.map((group, i) => {
          const groupActions = actions.filter((a) => a.group === group);
          if (groupActions.length === 0) return null;
          return (
            <div key={group}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={groupLabels[group]}>
                {groupActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={action.id}
                    onSelect={handleSelect}
                  >
                    <span className="flex-1 truncate">{action.label}</span>
                    {action.description && (
                      <span className="ml-2 text-xs text-muted-foreground truncate max-w-[120px]">
                        {action.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
