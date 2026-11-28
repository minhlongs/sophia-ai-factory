'use client';

/**
 * Sophia 39-Engine Live Mission Control (MD3 Expressive).
 *
 * Renders the single-viewport 5-Stage Cinematic Assembly Line by default
 * (with toggle to the full catalog grid), executes all 39 live engines via
 * POST /api/studio/pipeline/execute, surfaces inline role="alert" on failures,
 * injects live metrics into StudioInspectorDrawer, and produces a shareable
 * 39/39 Verified Receipt Card.
 *
 * @module components/studio-kit/studio-command-palette
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import {
  SOPHIA_STUDIO_CAPABILITIES,
  filterCapabilities,
  type CapabilityCategory,
  type StudioCapabilitySpec,
} from '@/seed/ui/studio-capability-registry';
import {
  DEFAULT_LIVE_PIPELINE_INPUT,
  evaluateSingleEngineLive,
  type EngineLiveTelemetry,
} from '@/seed/ui/live-pipeline-runner';
import {
  buildPipelineVerifiedReceipt,
  groupCapabilitiesIntoStages,
  type PipelineVerifiedReceipt,
} from '@/seed/ui/pipeline-stage-manifest';
import { PipelineAssemblyMatrix } from './pipeline-assembly-matrix';
import { PipelineVerifiedReceiptCard } from './pipeline-verified-receipt-card';
import {
  OpcCommanderRoeBar,
  regionToJurisdiction,
  type CommanderRoeConfig,
} from './opc-commander-roe-bar';
import { StudioKpiStrip } from './studio-kpi-strip';
import { StudioInspectorDrawer } from './studio-inspector-drawer';

export interface StudioCommandPaletteProps {
  readonly locale: 'vi' | 'en';
  readonly capabilities?: readonly StudioCapabilitySpec[];
  readonly campaignDraft?: {
    readonly script: string;
    readonly platform: CommanderRoeConfig['platform'];
    readonly region: CommanderRoeConfig['region'];
  };
}

interface ExecutePipelineResponse {
  readonly ok?: boolean;
  readonly error?: string;
  readonly executedAt?: string;
  readonly telemetrySource?: 'live_d1' | 'default_sample';
  readonly results?: readonly EngineLiveTelemetry[];
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function StudioCommandPalette({
  locale,
  capabilities = SOPHIA_STUDIO_CAPABILITIES,
  campaignDraft,
}: StudioCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [category] = useState<CapabilityCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'assembly' | 'catalog'>('assembly');
  const [selected, setSelected] = useState<StudioCapabilitySpec | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<Record<string, EngineLiveTelemetry>>({});
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [activeEngineId, setActiveEngineId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PipelineVerifiedReceipt | null>(null);
  const [roe, setRoe] = useState<CommanderRoeConfig>({
    script: campaignDraft?.script ?? DEFAULT_LIVE_PIPELINE_INPUT.script,
    platform: campaignDraft?.platform ?? 'tiktok',
    region: campaignDraft?.region ?? 'VN',
    useLiveD1Gross: true,
    customGrossUsd: DEFAULT_LIVE_PIPELINE_INPUT.grossUsd,
  });
  const runTokenRef = useRef(0);

  useEffect(() => {
    if (!campaignDraft) return;
    setRoe((prev) => ({
      ...prev,
      script: campaignDraft.script,
      platform: campaignDraft.platform,
      region: campaignDraft.region,
    }));
  }, [campaignDraft?.script, campaignDraft?.platform, campaignDraft?.region]);

  const stages = useMemo(() => groupCapabilitiesIntoStages(capabilities), [capabilities]);
  const orderedCapabilities = useMemo(
    () => stages.flatMap((s) => s.capabilities),
    [stages],
  );
  const filtered = useMemo(
    () => filterCapabilities(capabilities, { query, category, inspectorMode: true }),
    [capabilities, query, category],
  );
  const matchedIds = useMemo(() => new Set(filtered.map((c) => c.id)), [filtered]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('sophia-studio-cmdk-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function commitSequence(
    token: number,
    serverMap: Map<string, EngineLiveTelemetry> | null,
    executedAt: string,
    telemetrySource: 'live_d1' | 'default_sample',
  ) {
    const instant = prefersReducedMotion();
    const collected: Record<string, EngineLiveTelemetry> = {};

    if (instant) {
      for (const cap of orderedCapabilities) {
        const result = serverMap
          ? serverMap.get(cap.id)
          : evaluateSingleEngineLive(cap.id, DEFAULT_LIVE_PIPELINE_INPUT);
        if (result) collected[cap.id] = result;
      }
      if (runTokenRef.current !== token) return;
      setLiveTelemetry(collected);
      setActiveEngineId(null);
      setIsPipelineRunning(false);
      setReceipt(
        buildPipelineVerifiedReceipt(collected, executedAt, telemetrySource, orderedCapabilities.length),
      );
      return;
    }

    for (const cap of orderedCapabilities) {
      if (runTokenRef.current !== token) return;
      setActiveEngineId(cap.id);
      await new Promise((resolve) => setTimeout(resolve, 48));
      if (runTokenRef.current !== token) return;
      const result = serverMap
        ? serverMap.get(cap.id)
        : evaluateSingleEngineLive(cap.id, DEFAULT_LIVE_PIPELINE_INPUT);
      if (!result) continue;
      collected[cap.id] = result;
      setLiveTelemetry((prev) => ({ ...prev, [cap.id]: result }));
    }

    if (runTokenRef.current !== token) return;
    setActiveEngineId(null);
    setIsPipelineRunning(false);
    setReceipt(
      buildPipelineVerifiedReceipt(collected, executedAt, telemetrySource, orderedCapabilities.length),
    );
  }

  async function handleRunRealtimePipeline() {
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    setIsPipelineRunning(true);
    setLiveTelemetry({});
    setRunError(null);
    setReceipt(null);

    const payloadBody = {
      script: roe.script.trim() || DEFAULT_LIVE_PIPELINE_INPUT.script,
      platform: roe.platform,
      jurisdiction: regionToJurisdiction(roe.region),
      country: roe.region,
      postsToday: DEFAULT_LIVE_PIPELINE_INPUT.postsToday,
      ...(roe.useLiveD1Gross ? {} : { grossUsd: roe.customGrossUsd }),
    };

    try {
      const resp = await fetch('/api/studio/pipeline/execute', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify(payloadBody),
      });
      const payload = (await resp.json().catch(() => ({}))) as ExecutePipelineResponse;
      if (runTokenRef.current !== token) return;
      if (!resp.ok || payload.ok === false || !Array.isArray(payload.results)) {
        const detail = payload.error || `HTTP ${resp.status}`;
        setRunError(
          locale === 'vi'
            ? `Không thể kết nối máy chủ thực thi (${detail}). Bạn có thể thử lại hoặc chạy kiểm tra cục bộ.`
            : `Pipeline server request failed (${detail}). Retry or run local browser verification.`,
        );
        setIsPipelineRunning(false);
        return;
      }
      const serverMap = new Map<string, EngineLiveTelemetry>();
      for (const item of payload.results) {
        if (!serverMap.has(item.engineId)) serverMap.set(item.engineId, item);
      }
      await commitSequence(
        token,
        serverMap,
        payload.executedAt ?? new Date().toISOString(),
        payload.telemetrySource ?? 'default_sample',
      );
    } catch (err) {
      if (runTokenRef.current !== token) return;
      const detail = err instanceof Error ? err.message : 'Network error';
      setRunError(
        locale === 'vi'
          ? `Không thể kết nối máy chủ thực thi (${detail}). Bạn có thể thử lại hoặc chạy kiểm tra cục bộ.`
          : `Pipeline server request failed (${detail}). Retry or run local browser verification.`,
      );
      setIsPipelineRunning(false);
    }
  }

  async function handleRunLocalBrowserCheck() {
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    setIsPipelineRunning(true);
    setLiveTelemetry({});
    setRunError(null);
    setReceipt(null);
    await commitSequence(token, null, new Date().toISOString(), 'default_sample');
  }

  const inspectedCapability = useMemo(() => {
    if (!selected) return null;
    const tel = liveTelemetry[selected.id];
    if (!tel) return selected;
    return {
      ...selected,
      summary: {
        vi: `${selected.summary.vi} — ${tel.detail.vi}`,
        en: `${selected.summary.en} — ${tel.detail.en}`,
      },
      inspectorFields: [
        {
          key: 'live_output',
          label: { vi: 'Kết quả vừa chạy', en: 'Live Output' },
          value: tel.metricOutput,
          tone: tel.state === 'passed' ? ('success' as const) : tel.state === 'warning' ? ('warning' as const) : ('danger' as const),
        },
        {
          key: 'live_ms',
          label: { vi: 'Thời gian xử lý', en: 'Execution Time' },
          value: `${tel.durationMs} ms`,
          tone: 'neutral' as const,
        },
        ...selected.inspectorFields,
      ],
    };
  }, [selected, liveTelemetry]);

  const completedCount = Object.keys(liveTelemetry).length;

  return (
    <section
      aria-label={locale === 'vi' ? 'Nhà máy 39 động cơ AI realtime' : '39-Engine Live AI Mission Control'}
      className="md3-surface-card space-y-4 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-code text-[11px] font-bold uppercase tracking-wider text-primary">
            {isPipelineRunning
              ? locale === 'vi'
                ? 'REC • ĐANG CHẠY DÂY CHUYỀN THỰC TẾ'
                : 'REC • LIVE PIPELINE EXECUTING'
              : locale === 'vi'
                ? `NHÀ MÁY TỰ ĐỘNG • ${orderedCapabilities.length}/${orderedCapabilities.length} ĐỘNG CƠ SẴN SÀNG`
                : `AUTONOMOUS FACTORY • ${orderedCapabilities.length}/${orderedCapabilities.length} ENGINES READY`}
          </p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {locale === 'vi'
              ? 'Dây Chuyền 39 Động Cơ AI (5 Bước Khép Kín)'
              : '39-Engine Live AI Assembly Line (5-Stage)'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="run-39-engines-btn"
            disabled={isPipelineRunning}
            onClick={() => void handleRunRealtimePipeline()}
            className="md3-pill-button inline-flex min-h-[44px] items-center gap-2 bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <span className="font-code md3-tabular-nums">
              {isPipelineRunning
                ? locale === 'vi'
                  ? `Đang chạy ${completedCount}/${orderedCapabilities.length}…`
                  : `Running ${completedCount}/${orderedCapabilities.length}…`
                : receipt
                  ? locale === 'vi'
                    ? `Chạy Lại 39 Động Cơ (${receipt.totalComputeMs.toFixed(1)}ms)`
                    : `Re-Run 39 Engines (${receipt.totalComputeMs.toFixed(1)}ms)`
                  : locale === 'vi'
                    ? 'Chạy 39 Động Cơ Realtime'
                    : 'Run 39-Engine Live Pipeline'}
            </span>
          </button>

          <input
            id="sophia-studio-cmdk-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === 'vi' ? 'Tìm nhanh 39 động cơ (⌘K)…' : 'Search 39 engines (⌘K)…'}
            className="min-h-[44px] w-full rounded-full border border-border bg-background px-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:w-56"
          />

          <div className="inline-flex rounded-full border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('assembly')}
              className={`min-h-[40px] rounded-full px-3 text-xs font-semibold transition-colors ${
                viewMode === 'assembly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {locale === 'vi' ? 'Dây chuyền 5 Bước' : '5-Stage Line'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('catalog')}
              className={`min-h-[40px] rounded-full px-3 text-xs font-semibold transition-colors ${
                viewMode === 'catalog' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {locale === 'vi' ? 'Danh mục' : 'Catalog'}
            </button>
          </div>
        </div>
      </div>

      <OpcCommanderRoeBar
        locale={locale}
        value={roe}
        disabled={isPipelineRunning}
        onChange={setRoe}
      />

      {runError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/35 bg-[var(--error-container)] p-3.5 text-xs font-medium text-[var(--on-error-container)]"
        >
          <span>{runError}</span>
          <button
            type="button"
            onClick={() => void handleRunLocalBrowserCheck()}
            className="md3-pill-button inline-flex min-h-[44px] items-center border border-destructive/40 bg-background px-3.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            {locale === 'vi' ? 'Chạy kiểm tra cục bộ' : 'Run Local Browser Check'}
          </button>
        </div>
      ) : null}

      {viewMode === 'assembly' ? (
        <PipelineAssemblyMatrix
          locale={locale}
          stages={stages}
          matchedIds={matchedIds}
          selectedId={selected?.id ?? null}
          activeEngineId={activeEngineId}
          liveTelemetry={liveTelemetry}
          onSelectEngine={setSelected}
        />
      ) : (
        <StudioKpiStrip
          capabilities={filtered}
          locale={locale}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          liveTelemetry={liveTelemetry}
          activeEngineId={activeEngineId}
        />
      )}

      <PipelineVerifiedReceiptCard locale={locale} receipt={receipt} />

      <StudioInspectorDrawer
        capability={inspectedCapability}
        locale={locale}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
