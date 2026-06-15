/**
 * use-cmd-k-actions — builds action list for CmdK palette
 *
 * Merges static page actions + dynamic SOP/mission actions.
 * Admin actions are included only when isAdmin=true.
 * SOP installations fetched on open, cached 30s via useRef.
 *
 * @module components/cmd-k/use-cmd-k-actions
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CmdKAction } from './cmd-k-action-types';

/** Static dashboard page routes */
const STATIC_PAGES: Array<{ label: string; href: string }> = [
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

interface SopInstallation {
  id: string;
  sop_name: string;
}

interface MissionSummary {
  id: string;
  command: string;
}

interface UseCmdKActionsOptions {
  isAdmin: boolean;
  open: boolean;
  onRunSop?: (installationId: string, sopName: string) => void;
}

const CACHE_TTL_MS = 30_000;

export function useCmdKActions({ isAdmin, open, onRunSop }: UseCmdKActionsOptions): CmdKAction[] {
  const router = useRouter();
  const t = useTranslations('cmdK');
  const [installations, setInstallations] = useState<SopInstallation[]>([]);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const cacheRef = useRef<{ ts: number; data: { installations: SopInstallation[]; missions: MissionSummary[] } } | null>(null);

  const fetchDynamic = useCallback(async () => {
    const now = Date.now();
    if (cacheRef.current && now - cacheRef.current.ts < CACHE_TTL_MS) {
      setInstallations(cacheRef.current.data.installations);
      setMissions(cacheRef.current.data.missions);
      return;
    }

    const [sopRes, missionRes] = await Promise.allSettled([
      fetch('/api/v1/sop/installations?limit=20').then((r) => (r.ok ? r.json() : { items: [] })),
      fetch('/api/v1/missions?limit=20').then((r) => (r.ok ? r.json() : { missions: [] })),
    ]);

    const installationData: SopInstallation[] =
      sopRes.status === 'fulfilled'
        ? ((sopRes.value as { items?: SopInstallation[] }).items ?? [])
        : [];

    const missionData: MissionSummary[] =
      missionRes.status === 'fulfilled'
        ? ((missionRes.value as { missions?: MissionSummary[] }).missions ?? [])
        : [];

    cacheRef.current = { ts: now, data: { installations: installationData, missions: missionData } };
    setInstallations(installationData);
    setMissions(missionData);
  }, []);

  useEffect(() => {
    if (open) {
      void fetchDynamic();
    }
  }, [open, fetchDynamic]);

  const actions: CmdKAction[] = [];

  // Page navigation actions
  for (const page of STATIC_PAGES) {
    actions.push({
      id: `page:${page.href}`,
      label: page.label,
      group: 'pages',
      description: page.href,
      onSelect: () => router.push(page.href),
    });
  }

  // SOP run actions
  for (const inst of installations) {
    actions.push({
      id: `sop:run:${inst.id}`,
      label: `Run ${inst.sop_name}`,
      group: 'sops',
      onSelect: () => onRunSop?.(inst.id, inst.sop_name),
    });
  }

  // Open marketplace action
  actions.push({
    id: 'page:sop-marketplace',
    label: t('openMarketplace'),
    group: 'sops',
    onSelect: () => router.push('/dashboard/sop-marketplace'),
  });

  // Recent mission actions
  for (const mission of missions) {
    actions.push({
      id: `mission:${mission.id}`,
      label: mission.command.slice(0, 60),
      group: 'missions',
      description: `#${mission.id.slice(0, 8)}`,
      onSelect: () => router.push(`/dashboard/missions/${mission.id}`),
    });
  }

  // Admin-only actions
  if (isAdmin) {
    actions.push(
      {
        id: 'admin:ops',
        label: t('adminOps'),
        group: 'admin',
        adminOnly: true,
        onSelect: () => router.push('/dashboard/admin/ops'),
      },
      {
        id: 'admin:queue',
        label: t('showQueueDepth'),
        group: 'admin',
        adminOnly: true,
        onSelect: () => router.push('/dashboard/admin/ops?tab=queue'),
      },
    );
  }

  return actions;
}
