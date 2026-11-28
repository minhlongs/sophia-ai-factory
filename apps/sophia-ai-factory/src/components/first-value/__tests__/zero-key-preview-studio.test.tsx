import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ZeroKeyPreviewStudio, isZeroKeyPreviewEnabled } from '../zero-key-preview-studio';

const mockRenderPilotMp4Blob = vi.fn();

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

vi.mock('../pilot-browser-mp4-renderer', () => ({
  renderPilotMp4Blob: (...args: unknown[]) => mockRenderPilotMp4Blob(...args),
}));

describe('ZeroKeyPreviewStudio (Wave C.2 Release Seal)', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:http://127.0.0.1/mock-preview-mp4');
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

  it('rejects empty topic or audience without calling fixture_preview API', () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));

    expect(screen.getByRole('alert').textContent).toContain('chủ đề');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs fixture_preview with orgId + CSRF, supports edit/local-approval/render/download, invalidates on edit, and resets on orgId change', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        orgId: 'org-a',
        provenance: 'fixture_simulated',
        script: {
          title: 'Crypto Security',
          scenes: [{ narration: 'Scene 1: Check Proof of Reserves.' }],
        },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    mockRenderPilotMp4Blob.mockResolvedValue({
      encoded: { bytes: new Uint8Array([0, 1, 2, 3]), durationSec: 32, width: 320, height: 576 },
      blob: new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'video/mp4' }),
    });

    const { rerender, unmount } = render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);

    fireEvent.change(screen.getByTestId('preview-duration-select'), { target: { value: '45' } });
    fireEvent.change(screen.getByTestId('preview-audience-input'), { target: { value: 'Người mới' } });
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('preview-script-editor')).toBeTruthy();
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/first-value');
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBe('test-csrf-token');
    const reqBody = JSON.parse(init.body as string) as { action: string; orgId: string; durationSec: number };
    expect(reqBody.action).toBe('fixture_preview');
    expect(reqBody.orgId).toBe('org-a');
    expect(reqBody.durationSec).toBe(45);

    // Render button must NOT be visible before explicit local approval
    expect(screen.queryByTestId('preview-render-mp4-btn')).toBeNull();

    // Edit script -> switches label to USER_EDITED_SCRIPT
    fireEvent.change(screen.getByTestId('preview-script-editor'), {
      target: { value: 'Bước 1: Kiểm tra 2FA.\nBước 2: Không cam kết lợi nhuận.' },
    });
    expect(screen.getByText('USER_EDITED_SCRIPT')).toBeTruthy();

    // Approve locally -> render button unlocks -> render succeeds
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    fireEvent.click(screen.getByTestId('preview-render-mp4-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('preview-video-player')).toBeTruthy();
      expect(screen.getByTestId('preview-download-mp4-btn')).toBeTruthy();
    });
    expect(mockRenderPilotMp4Blob).toHaveBeenCalledTimes(1);

    // Editing topic invalidates approval & revokes previous video URL
    fireEvent.change(screen.getByTestId('preview-topic-input'), { target: { value: 'Chủ đề mới' } });
    expect(screen.queryByTestId('preview-video-player')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://127.0.0.1/mock-preview-mp4');

    // Switching workspace orgId resets script and state
    rerender(<ZeroKeyPreviewStudio orgId="org-b" enabled />);
    expect(screen.queryByTestId('preview-script-editor')).toBeNull();
    unmount();
  });

  it('surfaces inline error on HTTP 403, network failure, and render failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: 'Forbidden workspace' }),
    }) as unknown as typeof fetch;

    render(<ZeroKeyPreviewStudio orgId="org-a" enabled />);
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Forbidden workspace');
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Offline')) as unknown as typeof fetch;
    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Offline');
    });

    // Render failure path
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ script: { title: 'T', scenes: [{ narration: 'Line 1' }] } }),
    }) as unknown as typeof fetch;
    mockRenderPilotMp4Blob.mockRejectedValue(new Error('Encoder crashed'));

    fireEvent.click(screen.getByTestId('preview-generate-script-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-local-approve-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('preview-local-approve-btn'));
    fireEvent.click(screen.getByTestId('preview-render-mp4-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Encoder crashed');
    });
    expect(screen.queryByTestId('preview-video-player')).toBeNull();
  });
});
