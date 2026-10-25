'use client';

/**
 * Image studio state: brief, submission, job polling, selection.
 *
 * Ownership rules:
 *  - The brief is the user's text; it is only cleared on an explicit reset.
 *  - Submission is disabled while a job is in flight, so a double click or a
 *    re-render cannot spend twice on one brief.
 *  - Each job id owns its own poll. Switching selection abandons the previous
 *    poll rather than letting it overwrite the newer selection.
 *  - A failed submission keeps the brief, and never removes an earlier
 *    successful artifact.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateImageAction } from '@/app/actions/image-generate-action';
import type { ImageJobView } from '@/tree/creative-studio/image-job-view-model';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3';

export interface StudioModel {
  id: string;
  allowed: boolean;
}

export type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'accepted'; jobId: string }
  | { kind: 'failed'; message: string; code?: string };

const POLL_INTERVAL_MS = 2500;
const MAX_PROMPT_LENGTH = 2000;

export interface ImageStudioState {
  prompt: string;
  setPrompt: (value: string) => void;
  model: string;
  setModel: (id: string) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (value: AspectRatio) => void;
  submission: SubmissionState;
  submit: () => void;
  resetSubmission: () => void;
  /** Selected job in preview + history, or null for the empty workspace. */
  selectedJob: ImageJobView | null;
  /** All jobs this user owns, newest first, for the history region. */
  jobs: ImageJobView[];
  selectJob: (id: string) => void;
  /** Latest status for the selected job, refreshed by polling. */
  selectedStatus: { status: string; resultUrl: string | null } | null;
  statusError: string | null;
  retryStatus: () => void;
  isPromptTooShort: boolean;
  remainingChars: number;
}

export function useImageStudioState(
  initialJobs: ImageJobView[],
  models: StudioModel[],
): ImageStudioState {
  const [jobs, setJobs] = useState<ImageJobView[]>(initialJobs);
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(models[0]?.id ?? '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [submission, setSubmission] = useState<SubmissionState>({ kind: 'idle' });
  const [selectedStatus, setSelectedStatus] = useState<{
    status: string;
    resultUrl: string | null;
  } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pollNonce, setPollNonce] = useState(0);

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null;

  // ── Refresh the list after a state change ─────────────────────────────────
  const refreshJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/creative-studio/images');
      if (!response.ok) return;
      const body: unknown = await response.json();
      const data = body as { images?: ImageJobView[] };
      const incoming = data.images ?? [];
      setJobs(incoming);
      setSelectedId((current) =>
        current && incoming.some((job) => job.id === current)
          ? current
          : (incoming[0]?.id ?? null),
      );
    } catch {
      // Keep the last known list rather than blanking a previous success.
    }
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  // inFlightRef guards concurrent clicks and re-renders. The backend has no
  // idempotency key on image generation, so this client-side guard is the
  // only duplicate protection while a request is outstanding; it is not a
  // guarantee once the request is in flight on the server.
  const inFlightRef = useRef(false);

  const submit = useCallback(() => {
    if (inFlightRef.current) return;
    if (prompt.trim().length === 0) return;
    if (!model) return;

    inFlightRef.current = true;
    setSubmission({ kind: 'submitting' });
    void (async () => {
      const result = await generateImageAction({ prompt, model, aspectRatio });
      inFlightRef.current = false;
      if (result.success) {
        setSubmission({ kind: 'accepted', jobId: result.jobId });
        setSelectedId(result.jobId);
        setSelectedStatus({ status: 'pending', resultUrl: null });
        // The action returns only an id; the row appears on the next read.
        refreshJobs();
      } else {
        setSubmission({
          kind: 'failed',
          message: result.error,
          code: result.code,
        });
      }
    })();
  }, [aspectRatio, model, prompt, refreshJobs]);

  const resetSubmission = useCallback(() => {
    setSubmission({ kind: 'idle' });
  }, []);

  // ── Poll the selected job's status ────────────────────────────────────────
  useEffect(() => {
    if (!selectedJob) return;
    if (selectedJob.stage !== 'queued' && selectedJob.stage !== 'running') return;

    const jobId = selectedJob.id;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/v1/creative-studio/images/${jobId}/status`,
        );
        if (!response.ok) {
          if (!cancelled) setStatusError('statusUnavailable');
          return;
        }
        const body: unknown = await response.json();
        if (cancelled) return;
        const data = body as { status?: string; resultUrl?: string | null };
        setSelectedStatus({
          status: data.status ?? 'unknown',
          resultUrl: data.resultUrl ?? null,
        });
        setStatusError(null);
        if (data.status === 'completed' || data.status === 'failed') {
          refreshJobs();
          return;
        }
      } catch {
        if (!cancelled) setStatusError('statusUnavailable');
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // selectedJob.id is the stable identity; including the whole object would
    // restart polling on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.id, selectedJob?.stage, pollNonce]);

  const retryStatus = useCallback(() => {
    setPollNonce((n) => n + 1);
  }, []);

  const trimmed = prompt.trim();
  const isPromptTooShort = trimmed.length === 0;
  const remainingChars = MAX_PROMPT_LENGTH - prompt.length;

  return {
    prompt,
    setPrompt,
    model,
    setModel,
    aspectRatio,
    setAspectRatio,
    submission,
    submit,
    resetSubmission,
    selectedJob,
    jobs,
    selectJob: setSelectedId,
    selectedStatus,
    statusError,
    retryStatus,
    isPromptTooShort,
    remainingChars,
  };
}
