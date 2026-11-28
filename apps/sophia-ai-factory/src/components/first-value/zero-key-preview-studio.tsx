'use client';

/**
 * Zero-Key Preview Studio (Wave C.2 — PR #358 Final Correctness Seal).
 *
 * Allows an authenticated operator with NO BYOK API key to generate a
 * deterministic preview script via the existing stateless `fixture_preview`
 * action, edit & locally approve an immutable snapshot, and render/play/download
 * a real portrait 320x576 MP4 directly in the browser using `renderPilotMp4Blob`
 * (`encodePilotSlidesToMp4`) with 0 MCU and zero commercial side effects.
 *
 * @module components/first-value/zero-key-preview-studio
 */

import { useEffect, useRef, useState } from 'react';
import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { renderPilotMp4Blob } from './pilot-browser-mp4-renderer';

type PreviewPhase = 'DRAFT' | 'PENDING_LOCAL_REVIEW' | 'LOCALLY_APPROVED' | 'RENDERING' | 'RENDERED' | 'FAILED';

const MAX_PREVIEW_SCENES = 6;

interface ApprovedPreviewSnapshot {
  readonly orgId: string;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly scriptText: string;
  readonly revision: number;
}

export interface ZeroKeyPreviewStudioProps {
  readonly orgId: string;
  readonly enabled?: boolean;
}

export function isZeroKeyPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ZERO_KEY_PREVIEW === 'true';
}

function parseScriptLines(rawText: string): string[] {
  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildScriptOutputFromSnapshot(snapshot: ApprovedPreviewSnapshot): ScriptOutput {
  const lines = parseScriptLines(snapshot.scriptText);
  const safeLines = lines.length > 0 ? lines : [snapshot.topic];
  const perScene = Math.max(5, Math.floor((snapshot.durationSec - 4) / safeLines.length));
  return {
    title: snapshot.topic,
    total_duration: snapshot.durationSec,
    scenes: safeLines.map((narration, index) => ({
      scene_number: index + 1,
      duration_estimate: perScene,
      visual_description: narration,
      narration,
    })),
  };
}

export function ZeroKeyPreviewStudio({ orgId, enabled }: ZeroKeyPreviewStudioProps) {
  const isEnabled = enabled ?? isZeroKeyPreviewEnabled();
  const [topic, setTopic] = useState('Cách đánh giá bảo mật sàn giao dịch crypto an toàn cho người mới tại Việt Nam');
  const [audience, setAudience] = useState('Người mới tìm hiểu tài sản số');
  const [durationSec, setDurationSec] = useState(35);
  const [scriptText, setScriptText] = useState('');
  const [scriptSource, setScriptSource] = useState<'FIXTURE_SCRIPT' | 'USER_EDITED_SCRIPT'>('FIXTURE_SCRIPT');
  const [revision, setRevision] = useState(0);
  const [approvedSnapshot, setApprovedSnapshot] = useState<ApprovedPreviewSnapshot | null>(null);
  const [phase, setPhase] = useState<PreviewPhase>('DRAFT');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoRevision, setVideoRevision] = useState<number>(0);
  const [videoBytes, setVideoBytes] = useState<number>(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);

  const runTokenRef = useRef(0);
  const isEncodingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  function revokeCurrentMedia() {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
    setVideoRevision(0);
    setVideoBytes(0);
    setVideoDurationSec(0);
  }

  function invalidatePendingAndApproval(nextPhase: PreviewPhase) {
    runTokenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setApprovedSnapshot(null);
    setError(null);
    revokeCurrentMedia();
    setPhase(nextPhase);
  }

  // Reset all workspace-bound state when orgId changes
  useEffect(() => {
    runTokenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    isEncodingRef.current = false;
    setScriptText('');
    setApprovedSnapshot(null);
    setError(null);
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
    setVideoRevision(0);
    setVideoBytes(0);
    setVideoDurationSec(0);
    setPhase('DRAFT');
  }, [orgId]);

  // Unmount-only cleanup (never tied to videoUrl so clearing old media never invalidates next run)
  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
      abortRef.current?.abort();
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, []);

  if (!isEnabled) return null;

  const isRendering = phase === 'RENDERING';

  async function handleGeneratePreview() {
    if (!topic.trim() || !audience.trim()) {
      setError('Vui lòng nhập đầy đủ chủ đề và đối tượng mục tiêu.');
      setPhase('FAILED');
      return;
    }
    invalidatePendingAndApproval('DRAFT');
    const token = runTokenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/first-value', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({
          action: 'fixture_preview',
          orgId,
          topic: topic.trim(),
          audience: audience.trim(),
          durationSec,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        script?: { title?: string; scenes?: Array<{ narration?: string }> };
      };
      if (runTokenRef.current !== token) return;
      if (!resp.ok || json.ok === false || !json.script || !Array.isArray(json.script.scenes)) {
        setError(json.error || `HTTP ${resp.status}`);
        setPhase('FAILED');
        return;
      }
      const joined = json.script.scenes
        .map((s) => (typeof s?.narration === 'string' ? s.narration.trim() : ''))
        .filter(Boolean)
        .join('\n');
      if (!joined) {
        setError('Phản hồi kịch bản mô phỏng không hợp lệ hoặc rỗng.');
        setPhase('FAILED');
        return;
      }
      setScriptText(joined);
      setScriptSource('FIXTURE_SCRIPT');
      setRevision((r) => r + 1);
      setPhase('PENDING_LOCAL_REVIEW');
    } catch (err) {
      if (runTokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : 'Network error');
      setPhase('FAILED');
    }
  }

  function handleApproveLocalDraft() {
    if (isRendering || isEncodingRef.current) return;
    const lines = parseScriptLines(scriptText);
    if (lines.length === 0) {
      setError('Kịch bản không được để trống trước khi phê duyệt.');
      setPhase('FAILED');
      return;
    }
    if (lines.length > MAX_PREVIEW_SCENES) {
      setError(`Preview Studio hỗ trợ tối đa ${MAX_PREVIEW_SCENES} cảnh (hiện có ${lines.length} dòng). Vui lòng rút gọn để tránh cắt xén nội dung.`);
      setPhase('FAILED');
      return;
    }
    setError(null);
    setApprovedSnapshot({
      orgId,
      topic: topic.trim(),
      audience: audience.trim(),
      durationSec,
      scriptText,
      revision,
    });
    setPhase('LOCALLY_APPROVED');
  }

  async function handleRenderMp4() {
    if (phase !== 'LOCALLY_APPROVED' || !approvedSnapshot || isEncodingRef.current) return;
    const snapshot = approvedSnapshot;
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    isEncodingRef.current = true;
    setError(null);
    revokeCurrentMedia();
    setPhase('RENDERING');

    try {
      const script = buildScriptOutputFromSnapshot(snapshot);
      const { encoded, blob } = await renderPilotMp4Blob({
        artifactId: `preview-r${snapshot.revision}`,
        script,
        ctaText: 'Xem tài liệu giáo dục bảo mật (LOCAL_SIMULATION_NO_BYOK)',
        shortUrl: 'LOCAL_SIMULATION_NO_BYOK • SILENT_VIDEO',
        disclosureTag: '#AD • LOCAL_SIMULATION_NO_BYOK',
        aspectRatio: '9:16',
      });
      if (runTokenRef.current !== token) return;
      const url = URL.createObjectURL(blob);
      videoUrlRef.current = url;
      setVideoUrl(url);
      setVideoRevision(snapshot.revision);
      setVideoBytes(encoded.bytes.byteLength);
      setVideoDurationSec(encoded.durationSec);
      setPhase('RENDERED');
    } catch (err) {
      if (runTokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : 'Render failed');
      setPhase('FAILED');
    } finally {
      isEncodingRef.current = false;
    }
  }

  return (
    <section
      data-testid="zero-key-preview-studio"
      className="rounded-2xl border border-primary/30 bg-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Preview Studio Không Cần Khóa API (0 MCU)
          </h2>
          <p className="text-xs text-muted-foreground">
            Tạo kịch bản mô phỏng, chỉnh sửa, phê duyệt cục bộ và xuất video MP4 320×576 ngay trên trình duyệt mà không cần khóa BYOK.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">LOCAL_SIMULATION_NO_BYOK</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{scriptSource}</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">BROWSER_GENERATED</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">SILENT_VIDEO_ONLY</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
          Chủ đề video
          <input
            type="text"
            data-testid="preview-topic-input"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              invalidatePendingAndApproval(scriptText ? 'PENDING_LOCAL_REVIEW' : 'DRAFT');
            }}
            className="min-h-[44px] rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Thời lượng (30–45 giây)
          <select
            data-testid="preview-duration-select"
            value={durationSec}
            onChange={(e) => {
              setDurationSec(Number(e.target.value));
              invalidatePendingAndApproval(scriptText ? 'PENDING_LOCAL_REVIEW' : 'DRAFT');
            }}
            className="min-h-[44px] rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value={30}>30 giây</option>
            <option value={35}>35 giây</option>
            <option value={45}>45 giây</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-3">
          Đối tượng mục tiêu
          <input
            type="text"
            data-testid="preview-audience-input"
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value);
              invalidatePendingAndApproval(scriptText ? 'PENDING_LOCAL_REVIEW' : 'DRAFT');
            }}
            className="min-h-[44px] rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="preview-generate-script-btn"
          disabled={isRendering}
          onClick={() => void handleGeneratePreview()}
          className="min-h-[44px] rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          1. Tạo kịch bản xem trước (0 MCU)
        </button>
        {scriptText ? (
          <button
            type="button"
            data-testid="preview-local-approve-btn"
            disabled={isRendering}
            onClick={handleApproveLocalDraft}
            className="min-h-[44px] rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary-text disabled:opacity-50"
          >
            2. Phê duyệt cục bộ bản nháp (Rev #{revision})
          </button>
        ) : null}
        {approvedSnapshot && (phase === 'LOCALLY_APPROVED' || phase === 'RENDERING' || phase === 'RENDERED') ? (
          <button
            type="button"
            data-testid="preview-render-mp4-btn"
            disabled={isRendering}
            onClick={() => void handleRenderMp4()}
            className="min-h-[44px] rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isRendering ? 'Đang render MP4...' : '3. Render Video MP4 (320×576 • 0 MCU)'}
          </button>
        ) : null}
      </div>

      {scriptText ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Kịch bản cục bộ (tối đa {MAX_PREVIEW_SCENES} cảnh, mỗi dòng là 1 cảnh • chỉnh sửa sẽ hủy phê duyệt cũ)
          <textarea
            data-testid="preview-script-editor"
            rows={5}
            value={scriptText}
            onChange={(e) => {
              setScriptText(e.target.value);
              setScriptSource('USER_EDITED_SCRIPT');
              setRevision((r) => r + 1);
              invalidatePendingAndApproval('PENDING_LOCAL_REVIEW');
            }}
            className="rounded-xl border border-border bg-background p-3 text-sm text-foreground"
          />
        </label>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {videoUrl ? (
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-medium text-foreground">
            Video MP4 đã render ({videoBytes.toLocaleString()} bytes • ~{videoDurationSec}s • 320×576 • SILENT_VIDEO_ONLY)
          </p>
          <video
            data-testid="preview-video-player"
            src={videoUrl}
            controls
            playsInline
            className="mx-auto max-h-[360px] rounded-lg border border-border"
          />
          <a
            data-testid="preview-download-mp4-btn"
            href={videoUrl}
            download={`sophia-zero-key-preview-r${videoRevision}.mp4`}
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            4. Tải xuống Video MP4
          </a>
        </div>
      ) : null}
    </section>
  );
}
