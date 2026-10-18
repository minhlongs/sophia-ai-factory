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
import {
  buildCmdKActionList,
  type SopInstallation,
  type MissionSummary,
} from './cmd-k-action-builder';

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
  const cacheRef = useRef<{
    ts: number;
    data: { installations: SopInstallation[]; missions: MissionSummary[] };
  } | null>(null);

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

  return buildCmdKActionList({
    isAdmin,
    installations,
    missions,
    onNavigate: (href) => router.push(href),
    onRunSop,
    labels: {
      openMarketplace: t('openMarketplace'),
      adminOps: t('adminOps'),
      showQueueDepth: t('showQueueDepth'),
    },
  });
}
