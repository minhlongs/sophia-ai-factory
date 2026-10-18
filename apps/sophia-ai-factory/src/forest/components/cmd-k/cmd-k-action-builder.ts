/**
 * cmd-k-action-builder — builds action list items for CmdK palette
 *
 * @module components/cmd-k/cmd-k-action-builder
 */

'use client';

import type { CmdKAction } from './cmd-k-action-types';

/** Static dashboard page routes */
export const STATIC_PAGES: Array<{ label: string; href: string }> = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Missions', href: '/dashboard/missions' },
  { label: 'SOP Marketplace', href: '/dashboard/sop-marketplace' },
  { label: 'My SOPs', href: '/dashboard/sops' },
  { label: 'Credits', href: '/dashboard/credits' },
  { label: 'API Keys', href: '/dashboard/api-keys' },
  { label: 'Settings', href: '/dashboard/settings' },
  { label: 'Support', href: '/dashboard/support' },
  { label: 'API Docs', href: '/dashboard/api-docs' },
];

export interface SopInstallation {
  id: string;
  sop_name: string;
}

export interface MissionSummary {
  id: string;
  command: string;
}

export interface BuildCmdKActionsInput {
  isAdmin: boolean;
  installations: SopInstallation[];
  missions: MissionSummary[];
  onNavigate: (href: string) => void;
  onRunSop?: (installationId: string, sopName: string) => void;
  labels: {
    openMarketplace: string;
    adminOps: string;
    showQueueDepth: string;
  };
}

export function buildCmdKActionList({
  isAdmin,
  installations,
  missions,
  onNavigate,
  onRunSop,
  labels,
}: BuildCmdKActionsInput): CmdKAction[] {
  const actions: CmdKAction[] = [];

  for (const page of STATIC_PAGES) {
    actions.push({
      id: `page:${page.href}`,
      label: page.label,
      group: 'pages',
      description: page.href,
      onSelect: () => onNavigate(page.href),
    });
  }

  for (const inst of installations) {
    actions.push({
      id: `sop:run:${inst.id}`,
      label: `Run ${inst.sop_name}`,
      group: 'sops',
      onSelect: () => onRunSop?.(inst.id, inst.sop_name),
    });
  }

  actions.push({
    id: 'page:sop-marketplace',
    label: labels.openMarketplace,
    group: 'sops',
    onSelect: () => onNavigate('/dashboard/sop-marketplace'),
  });

  for (const mission of missions) {
    actions.push({
      id: `mission:${mission.id}`,
      label: mission.command.slice(0, 60),
      group: 'missions',
      description: `#${mission.id.slice(0, 8)}`,
      onSelect: () => onNavigate(`/dashboard/missions/${mission.id}`),
    });
  }

  if (isAdmin) {
    actions.push(
      {
        id: 'admin:ops',
        label: labels.adminOps,
        group: 'admin',
        adminOnly: true,
        onSelect: () => onNavigate('/dashboard/admin/ops'),
      },
      {
        id: 'admin:queue',
        label: labels.showQueueDepth,
        group: 'admin',
        adminOnly: true,
        onSelect: () => onNavigate('/dashboard/admin/ops?tab=queue'),
      },
    );
  }

  return actions;
}
