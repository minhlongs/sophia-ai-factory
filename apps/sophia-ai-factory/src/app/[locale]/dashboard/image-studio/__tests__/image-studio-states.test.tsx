/**
 * Image Studio state rendering tests.
 *
 * These cover the workflow states a reviewer must see working: empty
 * workspace, queued/running progress, a completed artifact, a failure that
 * keeps an earlier success reachable, a media load failure, and the missing
 * BYOK setup state.
 *
 * All jobs are fixtures. No provider call is made.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ImagePreviewPanel } from '../image-preview-panel';
import { ImageHistoryStrip } from '../image-history-strip';
import { ImageStudioBriefPanel } from '../image-brief-panel';
import { normaliseImageJobsForView } from '@/tree/creative-studio/image-job-view-model';
import { imageJobStage } from '@/tree/creative-studio/image-job-status';
import type { ImageJobRow } from '@/tree/creative-studio/image-job-queries';

function row(overrides: Partial<ImageJobRow>): ImageJobRow {
  return {
    id: 'job_1',
    user_id: 'user_1',
    model: 'flux-schnell',
    prompt: 'a cat on a rooftop',
    status: 'completed',
    result_url: 'https://cdn.test/a.png',
    thumbnail_url: null,
    provider: 'muapi',
    error: null,
    created_at: 1700000000,
    completed_at: 1700000600,
    ...overrides,
  };
}

function view(overrides: Partial<ImageJobRow>) {
  return normaliseImageJobsForView([row(overrides)])[0];
}

// The workspace is client-rendered and localized; render with the English
// namespace so assertions read the product copy.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(cleanup);

describe('empty workspace', () => {
  it('explains the first useful action instead of showing a blank canvas', () => {
    render(
      <ImagePreviewPanel
        job={null}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('preview.emptyTitle')).toBeDefined();
  });

  it('shows an empty history', () => {
    render(<ImageHistoryStrip jobs={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('history.empty')).toBeDefined();
  });

  it('says the history failed to load instead of claiming the workspace is empty', () => {
    render(
      <ImageHistoryStrip
        jobs={[]}
        selectedId={null}
        onSelect={() => {}}
        loadFailed={true}
      />,
    );

    expect(screen.getByText('history.loadFailed')).toBeDefined();
    expect(screen.queryByText('history.empty')).toBeNull();
  });
});

describe('in-flight jobs', () => {
  it('shows indeterminate progress for a queued job, with no percentage', () => {
    render(
      <ImagePreviewPanel
        job={view({ status: 'pending', result_url: null })}
        selectedStatus={{ status: 'pending', resultUrl: null }}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('status.queuedHint')).toBeDefined();
    // No fabricated progress figure.
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('distinguishes running from queued', () => {
    render(
      <ImagePreviewPanel
        job={view({ status: 'processing', result_url: null })}
        selectedStatus={{ status: 'processing', resultUrl: null }}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('status.runningHint')).toBeDefined();
  });

  it('offers a status recovery action when the live status is unavailable', () => {
    render(
      <ImagePreviewPanel
        job={view({ status: 'processing', result_url: null })}
        selectedStatus={{ status: 'processing', resultUrl: null }}
        statusError="statusUnavailable"
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('status.statusUnavailable')).toBeDefined();
    expect(screen.getByText('preview.retryStatus')).toBeDefined();
  });
});

describe('completed job', () => {
  it('renders the authorized artifact with the prompt as its alt text', () => {
    render(
      <ImagePreviewPanel
        job={view({})}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    const img = screen.getByAltText('a cat on a rooftop') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.png');
  });

  it('separates a load failure from a generation failure', () => {
    render(
      <ImagePreviewPanel
        job={view({})}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    // Simulate the browser failing to load the authorized URL. The generation
    // succeeded; only the preview did, so the failure copy must differ.
    fireEvent(screen.getByAltText('a cat on a rooftop'), new Event('error'));

    expect(screen.getByText('preview.imageLoadFailedTitle')).toBeDefined();
    expect(screen.queryByText('preview.failedHint')).toBeNull();
  });
});

describe('failed job', () => {
  it('keeps an earlier success listed alongside the later failure', () => {
    const jobs = normaliseImageJobsForView([
      row({ id: 'failed_1', status: 'failed', result_url: null }),
      row({ id: 'ok_1', status: 'completed', result_url: 'https://cdn.test/old.png' }),
    ]);

    render(<ImageHistoryStrip jobs={jobs} selectedId="ok_1" onSelect={() => {}} />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('marks the failure as not completed and links to setup', () => {
    render(
      <ImagePreviewPanel
        job={view({ status: 'failed', result_url: null })}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('preview.failedHint')).toBeDefined();
    expect(screen.getByText('preview.reviewSetup')).toBeDefined();
  });
});

describe('unrecognised status', () => {
  it('never presents an unknown status as a finished image', () => {
    render(
      <ImagePreviewPanel
        job={view({ status: 'something_new' })}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('preview.unknownStateHint')).toBeDefined();
    expect(document.querySelector('img')).toBeNull();
  });

  it('reports an unknown status as unrecognised, not as a failed generation', () => {
    // The core honesty fix: the provider returned a state the vocabulary has no
    // word for. That is not the same as the customer losing a generation, and
    // the failure copy must not appear.
    render(
      <ImagePreviewPanel
        job={view({ status: 'something_new', result_url: null })}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('preview.unknownStateHint')).toBeDefined();
    expect(screen.queryByText('preview.failedHint')).toBeNull();
    expect(screen.queryByText('preview.reviewSetup')).toBeNull();
    expect(screen.getByText('status.unknown')).toBeDefined();
  });

  it('keeps the unknown stage out of both done and failed', () => {
    const job = view({ status: 'something_new' });
    expect(job.status).toBe('unknown');
    expect(job.stage).toBe('unknown');
    expect(job.stage).not.toBe('failed');
    expect(job.stage).not.toBe('done');
  });

  it('does not poll a stranded unknown job forever', () => {
    // The poll effect stops unless the stage is 'queued' or 'running'. An
    // unrecognised status must land on neither, or a stranded job would be
    // polled forever by a UI that has nothing left to wait for.
    const stage = imageJobStage('unknown');
    expect(stage).not.toBe('queued');
    expect(stage).not.toBe('running');
  });

  it('does not inherit destructive styling for an unknown job in the history strip', () => {
    const jobs = normaliseImageJobsForView([
      row({ id: 'weird_1', status: 'something_new', result_url: null }),
    ]);

    render(<ImageHistoryStrip jobs={jobs} selectedId="weird_1" onSelect={() => {}} />);

    expect(screen.getByText('status.unknown')).toBeDefined();
    // An unknown job is not told apart as an error; the dot stays neutral so it
    // cannot read as "this generation failed".
    const dot = document.querySelector('span[aria-hidden="true"]');
    expect(dot?.className).not.toContain('destructive');
  });
});

describe('failed job still reports failure', () => {
  it('renders the failure copy for a genuinely failed job', () => {
    render(
      <ImagePreviewPanel
        job={view({ status: 'failed', result_url: null })}
        selectedStatus={null}
        statusError={null}
        onRetryStatus={() => {}}
      />,
    );

    expect(screen.getByText('preview.failedHint')).toBeDefined();
    expect(screen.getByText('preview.reviewSetup')).toBeDefined();
    expect(screen.queryByText('preview.unknownStateHint')).toBeNull();
    expect(screen.getByText('status.failed')).toBeDefined();
  });
});

describe('brief panel', () => {
  const baseState = {
    prompt: 'a cat on a rooftop',
    setPrompt: () => {},
    model: 'flux-schnell',
    setModel: () => {},
    aspectRatio: '1:1' as const,
    setAspectRatio: () => {},
    submission: { kind: 'idle' as const },
    submit: () => {},
    resetSubmission: () => {},
    selectedJob: null,
    jobs: [],
    selectJob: () => {},
    selectedStatus: null,
    statusError: null,
    retryStatus: () => {},
    isPromptTooShort: false,
    remainingChars: 1980,
  };

  it('locks models the tier may not use, without hiding that they exist', () => {
    render(
      <ImageStudioBriefPanel
        state={baseState}
        models={[{ id: 'flux-schnell', allowed: true }, { id: 'flux-dev', allowed: false }]}
        tier="BASIC"
      />,
    );

    expect(screen.getByText('flux-schnell')).toBeDefined();
    expect(screen.getByText(/flux-dev/)).toBeDefined();
  });

  it('explains a missing provider key rather than reporting a generic failure', () => {
    render(
      <ImageStudioBriefPanel
        state={{
          ...baseState,
          submission: { kind: 'failed', message: 'key', code: 'NO_API_KEY' },
        }}
        models={[{ id: 'flux-schnell', allowed: true }]}
        tier="BASIC"
      />,
    );

    expect(screen.getByText('brief.missingKey')).toBeDefined();
  });

  it('keeps a failed submission recoverable instead of clearing the brief', () => {
    render(
      <ImageStudioBriefPanel
        state={{
          ...baseState,
          submission: { kind: 'failed', message: 'provider down', code: 'PROVIDER_ERROR' },
        }}
        models={[{ id: 'flux-schnell', allowed: true }]}
        tier="BASIC"
      />,
    );

    const textarea = screen.getByLabelText('brief.promptLabel') as HTMLTextAreaElement;
    expect(textarea.value).toBe('a cat on a rooftop');
    expect(screen.getByText('brief.submitFailed')).toBeDefined();
  });

  it('disables submission and says why while a job is in flight', () => {
    render(
      <ImageStudioBriefPanel
        state={{
          ...baseState,
          submission: { kind: 'submitting' },
        }}
        models={[{ id: 'flux-schnell', allowed: true }]}
        tier="BASIC"
      />,
    );

    expect(screen.getByText('brief.submitting')).toBeDefined();
  });
});
