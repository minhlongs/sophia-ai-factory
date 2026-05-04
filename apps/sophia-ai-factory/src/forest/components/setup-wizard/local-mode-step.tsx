'use client';

/**
 * LocalModeStep — Setup Wizard tab for activating Local Mode (Qwen on M1 Mac).
 * Polls GET /api/setup/local-mode/status every 5s after install one-liner shown.
 * Sub-components (CopyBox, StatusBadge) live in local-mode-step-ui.tsx.
 * Phase E: UI-only. Provision API provided by Phase D.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { CopyBox, StatusBadge, type LocalModeStatus } from './local-mode-step-ui';
import { useCsrfToken } from '@/seed/security/use-csrf-token';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatusPayload {
  provisioned: boolean;
  endpoint_hostname: string | null;
  last_health_at: string | null;
  status: 'healthy' | 'stale' | 'failed' | 'unknown';
}

const INSTALL_CMD = 'curl -fsSL https://sophia.agencyos.network/install/local-mode | bash';
const POLL_INTERVAL_MS = 5_000;

// ── Eligibility check ──────────────────────────────────────────────────────────

function checkEligibility(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isMac = /Macintosh.*Apple/i.test(navigator.userAgent);
  // navigator.deviceMemory is non-standard; graceful fallback if absent
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const hasEnoughRam = mem === undefined || mem >= 16;
  return isMac && hasEnoughRam;
}

// ── Type guard — validates API response shape before applyPayload (B7) ─────────

function isStatusPayload(v: unknown): v is StatusPayload {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj['provisioned'] === 'boolean' &&
    (obj['endpoint_hostname'] === null || typeof obj['endpoint_hostname'] === 'string') &&
    (obj['last_health_at'] === null || typeof obj['last_health_at'] === 'string') &&
    (obj['status'] === 'healthy' || obj['status'] === 'stale' ||
     obj['status'] === 'failed' || obj['status'] === 'unknown')
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function LocalModeStep() {
  const csrfHeaders = useCsrfToken();
  const [uiStatus, setUiStatus] = useState<LocalModeStatus>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const applyPayload = (data: StatusPayload, stopOnProvisioned = false) => {
    if (!data.provisioned) { setUiStatus('polling'); return; }
    const next: LocalModeStatus =
      data.status === 'healthy' ? 'provisioned-healthy' :
      data.status === 'stale'   ? 'provisioned-stale'   : 'provisioned-failed';
    if (stopOnProvisioned) stopPolling();
    setUiStatus(next);
  };

  const pollStatus = async () => {
    try {
      const res = await fetch('/api/setup/local-mode/status');
      if (!res.ok) return;
      const raw: unknown = await res.json();
      if (!isStatusPayload(raw)) return;
      applyPayload(raw, true);
    } catch { /* network error — keep polling */ }
  };

  useEffect(() => {
    if (!checkEligibility()) { setUiStatus('ineligible'); return; }

    void (async () => {
      try {
        const res = await fetch('/api/setup/local-mode/status');
        if (!res.ok) { setUiStatus('not-provisioned'); return; }
        const raw: unknown = await res.json();
        if (!isStatusPayload(raw)) { setUiStatus('not-provisioned'); return; }
        if (!raw.provisioned) { setUiStatus('not-provisioned'); return; }
        applyPayload(raw);
      } catch { setUiStatus('not-provisioned'); }
    })();

    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartPolling = () => {
    setUiStatus('polling');
    intervalRef.current = setInterval(() => { void pollStatus(); }, POLL_INTERVAL_MS);
  };

  // Disable Local Mode — DELETE /api/setup/local-mode/provision
  const handleDisable = async () => {
    try {
      await fetch('/api/setup/local-mode/provision', { method: 'DELETE', headers: { ...csrfHeaders } });
      setUiStatus('not-provisioned');
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Chế Độ Cục Bộ / Local Mode
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Chạy Qwen trực tiếp trên Mac M-series để giảm chi phí API.
          <br />
          <span className="text-xs">Run Qwen locally on Apple Silicon Mac to reduce API costs.</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Trạng thái:</span>
        <StatusBadge status={uiStatus} />
      </div>

      {uiStatus === 'ineligible' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
          <p className="font-medium">Thiết bị không tương thích / Device not compatible</p>
          <p className="mt-1 text-xs">Yêu cầu: Mac Apple Silicon với ≥16 GB RAM. Local Mode chỉ hoạt động trên macOS.</p>
          <p className="text-xs">Requires: Apple Silicon Mac with ≥16 GB RAM. Local Mode is macOS-only.</p>
        </div>
      )}

      {uiStatus === 'not-provisioned' && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-200">Hướng dẫn cài đặt / Install Instructions</p>
            <p className="text-blue-800 dark:text-blue-300 text-xs mt-1">
              Chạy lệnh sau trong Terminal trên Mac của bạn. Model ~21 GB, cần ≥50 GB dung lượng trống.
              <br />Run in Terminal on your Mac. Model ~21 GB download, requires ≥50 GB free disk space.
            </p>
          </div>
          <CopyBox text={INSTALL_CMD} />
          <button
            onClick={handleStartPolling}
            className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Tôi đã chạy lệnh, bắt đầu kiểm tra… / I ran it, start checking…
          </button>
        </div>
      )}

      {uiStatus === 'polling' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 motion-safe:animate-spin" />
          Đang chờ installer hoàn tất… / Waiting for installer to complete…
        </div>
      )}

      {(uiStatus === 'provisioned-healthy' || uiStatus === 'provisioned-stale') && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-800 dark:text-green-300">
          <p className="font-medium">Local Mode đã kích hoạt / Local Mode active</p>
          <p className="text-xs mt-1">Sophia đang định tuyến yêu cầu qua mekongd trên máy của bạn.</p>
          <p className="text-xs">Sophia is routing requests through mekongd on your machine.</p>
        </div>
      )}

      {uiStatus === 'provisioned-failed' && (
        <div className="space-y-3">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800 dark:text-red-300">
            <p className="font-medium">Mất kết nối / Connection lost</p>
            <p className="text-xs mt-1">Kiểm tra mekongd có đang chạy trên Mac không. / Check that mekongd is running on your Mac.</p>
          </div>
          <button
            onClick={() => void handleDisable()}
            className="text-xs text-red-600 underline underline-offset-2 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
          >
            Tắt Local Mode / Disable Local Mode
          </button>
        </div>
      )}
    </div>
  );
}
