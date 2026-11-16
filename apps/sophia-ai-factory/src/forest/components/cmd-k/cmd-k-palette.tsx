'use client';
/**
 * CmdK Palette — global command palette triggered by Cmd+K / Ctrl+K
 *
 * Wraps shadcn/ui CommandDialog (backed by cmdk lib).
 * Sources: page navigation, SOP runs, recent missions, admin actions (role-gated).
 * Recent commands stored in localStorage (last 5).
 *
 * @module components/cmd-k/cmd-k-palette
 */

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/seed/components/ui/command';
import { useCmdKActions } from './use-cmd-k-actions';
import type { ActionGroup } from './cmd-k-action-types';
import { loadRecent, saveRecent } from './cmd-k-recent-storage';
import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import { toast } from 'sonner';

export { loadRecent, saveRecent };

interface CmdKPaletteProps {
  isAdmin: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type GroupLabel = Record<ActionGroup, string>;

export function CmdKPalette({
  isAdmin,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CmdKPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(open) : next;
      if (controlledOpen === undefined) {
        setInternalOpen(resolved);
      }
      controlledOnOpenChange?.(resolved);
    },
    [controlledOnOpenChange, controlledOpen, open],
  );
  const t = useTranslations('cmdK');

  const handleRunSop = useCallback(async (installationId: string, sopName: string) => {
    setOpen(false);
    try {
      const res = await fetch(`/api/v1/sop/installations/${installationId}/run`, {
        method: 'POST',
        headers: { ...getCsrfHeaders() },
      });
      if (res.ok) {
        toast.success(`Running ${sopName}`, { description: 'Check Missions for progress.' });
      } else {
        toast.error('Run failed');
      }
    } catch {
      toast.error('Network error');
    }
  }, [setOpen]);

  const actions = useCmdKActions({ isAdmin, open, onRunSop: handleRunSop });

  // Keyboard shortcut: Cmd+K / Ctrl+K + custom trigger event
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openEventHandler = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('sophia:open-cmd-k', openEventHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('sophia:open-cmd-k', openEventHandler);
    };
  }, [setOpen]);

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
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('title')}
      description={t('description')}
      closeLabel={t('close')}
    >
      <CommandInput placeholder={t('placeholder')} />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>
        {groups
          .map((group) => ({
            group,
            groupActions: actions.filter((a) => a.group === group),
          }))
          .filter(({ groupActions }) => groupActions.length > 0)
          .map(({ group, groupActions }, idx) => (
            <Fragment key={group}>
              {idx > 0 && <CommandSeparator />}
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
            </Fragment>
          ))}
      </CommandList>
    </CommandDialog>
  );
}
