import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ZeroKeyPreviewStudio, isZeroKeyPreviewEnabled } from '../zero-key-preview-studio';

const mockRenderPilotMp4Blob = vi.fn();

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

vi.mock('../pilot-browser-mp4-renderer', () => ({
  renderPilotMp4Blob: (...args: unknown[]) => mockRenderPilotMp4Blob(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ZeroKeyPreviewStudio concurrency, snapshot & content integrity (PR #358)', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    let seq = 0;
    URL.createObjectURL = vi.fn(() => `blob:http://127.0.0.1/mock-preview-${++seq}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('defaults to disabled when NEXT_PUBLIC_ENABLE_ZERO_KEY_PREVIEW is not true', () => {
    expect(isZeroKeyPreviewEnabled()).toBe(false);
    const { container } = render(<ZeroKeyPreviewStudio orgId="org-a" />);
    expect(container.firstChild).toBeNull();
  });

  it('A: discards stale fixture response when brief is edited while request is in flight', async () => {
    const req = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    globalThis.fetch = vi.fn().mockReturnValue(req.promise) as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: 'New topic while pending' } });

    await act(async () => {
      req.resolve({
        ok: true,
        status: 200,
        json: async () => ({ script: { title: 'Old', scenes: [{ narration: 'Stale scene' }] } }),
      });
    });

    expect(screen.queryByTestId('preview-script-editor')).toBeNull();
  });

  it('B & H: discards stale render when edited mid-render and prevents concurrent encoders', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'T', scenes: [{ narration: 'Script A' }] } }),
    }) as unknown as typeof fetch;

    const renderA = deferred<{ encoded: { bytes: Uint8Array; durationSec: number }; blob: Blob }>();
    mockRenderPilotMp4Blob.mockReturnValueOnce(renderA.promise);

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-local-approve-btn')).toBeTruthy());

    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    fireEvent.click(screen.getByTestId('preview-render-mp4-btn'));

    // Approve & render buttons are disabled while rendering (single-encoder guard)
    expect((screen.getByTestId('preview-local-approve-btn') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('preview-render-mp4-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(mockRenderPilotMp4Blob).toHaveBeenCalledTimes(1);

    // Edit script into Script B while Render A is pending -> invalidates Render A
    fireEvent.change(screen.getByTestId('preview-script-editor'), { target: { value: 'Script B' } });

    await act(async () => {
      renderA.resolve({
        encoded: { bytes: new Uint8Array([1, 2, 3]), durationSec: 32 },
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }),
      });
    });

    expect(screen.queryByTestId('preview-video-player')).toBeNull();
    expect(screen.queryByTestId('preview-download-mp4-btn')).toBeNull();
  });

  it('C, D, E: invalidates approval when topic, audience, or duration changes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'T', scenes: [{ narration: 'Line 1' }] } }),
    }) as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-local-approve-btn')).toBeTruthy());

    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    expect(screen.getByTestId('preview-render-mp4-btn')).toBeTruthy();
    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: 'Topic 2' } });
    expect(screen.queryByTestId('preview-render-mp4-btn')).toBeNull();

    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    expect(screen.getByTestId('preview-render-mp4-btn')).toBeTruthy();
    fireEvent.change(screen.getByTestId('preview-audience-input'), { target: { value: 'Audience 2' } });
    expect(screen.queryByTestId('preview-render-mp4-btn')).toBeNull();

    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    expect(screen.getByTestId('preview-render-mp4-btn')).toBeTruthy();
    fireEvent.change(screen.getByTestId('preview-duration-select'), { target: { value: '45' } });
    expect(screen.queryByTestId('preview-render-mp4-btn')).toBeNull();
  });

  it('F, G, I: supports second render after URL cleanup, resets on workspace change, and cleans up on unmount', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'T', scenes: [{ narration: 'Scene 1' }] } }),
    }) as unknown as typeof fetch;
    mockRenderPilotMp4Blob.mockResolvedValue({
      encoded: { bytes: new Uint8Array([1, 2, 3, 4]), durationSec: 32 },
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'video/mp4' }),
    });

    const { rerender, unmount } = render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-local-approve-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    fireEvent.click(screen.getByTestId('preview-render-mp4-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-video-player')).toBeTruthy());

    // Generate a second script -> cleanup of first videoUrl MUST NOT invalidate second render
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-local-approve-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    fireEvent.click(screen.getByTestId('preview-render-mp4-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-video-player')).toBeTruthy());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://127.0.0.1/mock-preview-1');

    // Workspace change clears state
    rerender(<ZeroKeyPreviewStudio orgId="org-b" enabled />);
    expect(screen.queryByTestId('preview-script-editor')).toBeNull();
    unmount();
  });

  it('J & G4: rejects malformed HTTP 200 fixture and blocks >6 scenes without silent truncation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'Bad', scenes: [] } }),
    }) as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('không hợp lệ'));

    // Valid fixture -> edit to 7 lines -> explicit validation error instead of silent .slice(0, 6)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'OK', scenes: [{ narration: 'Line 1' }] } }),
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-script-editor')).toBeTruthy());

    fireEvent.change(screen.getByTestId('preview-script-editor'), {
      target: { value: '1\n2\n3\n4\n5\n6\n7' },
    });
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    expect(screen.getByRole('alert').textContent).toContain('tối đa 6 cảnh');
    expect(screen.queryByTestId('preview-render-mp4-btn')).toBeNull();
  });

  it('handles empty brief, HTTP 403, network error, and encoder failure cleanly', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    expect(screen.getByRole('alert').textContent).toContain('chủ đề');
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: 'Valid topic' } });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: 'Forbidden workspace' }),
    }) as unknown as typeof fetch;
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Forbidden workspace'));

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Offline')) as unknown as typeof fetch;
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Offline'));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'T', scenes: [{ narration: 'Line 1' }] } }),
    }) as unknown as typeof fetch;
    mockRenderPilotMp4Blob.mockRejectedValueOnce(new Error('Encoder crashed'));
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-local-approve-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    fireEvent.click(screen.getByTestId('preview-render-mp4-btn'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Encoder crashed'));
  });

  it('emits immutable PreviewHandoffSnapshot on Nâng cấp nội dung với AI without altering authorization', async () => {
    const onUpgrade = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'T', scenes: [{ narration: 'Original scene' }] } }),
    }) as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled onUpgradeToByok={onUpgrade} />);
    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: 'Crypto Security VN' } });
    fireEvent.change(screen.getByTestId('preview-audience-input'), { target: { value: 'Newcomers' } });
    fireEvent.change(screen.getByTestId('preview-duration-select'), { target: { value: '45' } });
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-script-editor')).toBeTruthy());

    fireEvent.change(screen.getByTestId('preview-script-editor'), {
      target: { value: 'Edited VI script — WAVE_C3_MARKER' },
    });
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    expect(screen.getByText(/Giữ nguyên chủ đề và kịch bản đã chuẩn bị/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId('preview-upgrade-to-byok-btn'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-a',
        topic: 'Crypto Security VN',
        audience: 'Newcomers',
        durationSec: 45,
        scriptText: 'Edited VI script — WAVE_C3_MARKER',
        provenance: 'USER_EDITED_SCRIPT',
        contentLanguage: 'vi',
      }),
    );
  });
});
