import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/seed/security/use-csrf-token', () => ({
  useCsrfToken: () => ({ 'x-csrf-token': 'csrf-token' }),
}));

import { useOpenCorePortability } from './use-open-core-portability';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('useOpenCorePortability', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads runtime status and ignores a non-success payload', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }))
      .mockResolvedValueOnce(response({ success: false, edition: 'cloud', features: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() => useOpenCorePortability());
    await waitFor(() => expect(result.current.statusData?.edition).toBe('community'));
    unmount();

    const second = renderHook(() => useOpenCorePortability());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(second.result.current.statusData).toBeNull();
    second.unmount();
  });

  it('ignores status fetch failures without breaking the hook', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const { result } = renderHook(() => useOpenCorePortability());

    await waitFor(() => expect(result.current.statusData).toBeNull());
    expect(result.current.notice).toBeNull();
  });

  it('posts the license key with CSRF headers and reports a valid preview', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }))
      .mockResolvedValueOnce(response({ valid: true, licenseSummary: { tier: 'MASTER', edition: 'enterprise' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpenCorePortability());

    await act(async () => result.current.handleValidateLicensePreview('signed-license'));

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-csrf-token': 'csrf-token', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ licenseKey: 'signed-license' });
    expect(result.current.validationFeedback).toEqual({
      ok: true,
      message: 'Verified preview: MASTER (enterprise). Set RAAS_LICENSE_KEY in server env to persist.',
    });
  });

  it('clears the prior license feedback and reports invalid preview reasons', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }))
      .mockResolvedValueOnce(response({ valid: false, reason: 'SIGNATURE_MISMATCH' }, 422));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpenCorePortability());
    act(() => result.current.setValidationFeedback({ ok: true, message: 'old result' }));

    await act(async () => result.current.handleValidateLicensePreview('bad-license'));

    expect(result.current.validationFeedback).toEqual({ ok: false, message: 'Validation failed: SIGNATURE_MISMATCH' });
  });

  it('exports a signed bundle and restores the busy state after an API error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }))
      .mockResolvedValueOnce(response({ success: true, bundle: { version: 1, data: { locale: 'vi' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpenCorePortability());

    await act(async () => result.current.handleExportWorkspace());

    expect(result.current.bundleJson).toBe(JSON.stringify({ version: 1, data: { locale: 'vi' } }, null, 2));
    expect(result.current.notice).toContain('no plaintext keys included');
    expect(result.current.isBusy).toBe(false);

    fetchMock.mockResolvedValueOnce(response({ success: false, message: 'Export disabled' }, 503));
    await act(async () => result.current.handleExportWorkspace());
    expect(result.current.notice).toBe('Export disabled');
    expect(result.current.isBusy).toBe(false);
  });

  it('does not submit a blank import and reports invalid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpenCorePortability());

    await act(async () => result.current.handleImportWorkspace());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => result.current.setBundleJson('{invalid'));
    await act(async () => result.current.handleImportWorkspace());
    expect(result.current.notice).toBe('Invalid JSON bundle format.');
    expect(result.current.isBusy).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts an import bundle and distinguishes persisted and preview responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }))
      .mockResolvedValueOnce(response({ success: true, persisted: true }))
      .mockResolvedValueOnce(response({ success: true, persisted: false }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpenCorePortability());
    act(() => result.current.setBundleJson('{"version":1}'));

    await act(async () => result.current.handleImportWorkspace());
    expect(result.current.notice).toBe('Workspace configuration verified and persisted to D1.');

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-csrf-token': 'csrf-token', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ version: 1 });

    await act(async () => result.current.handleImportWorkspace());
    expect(result.current.notice).toBe('Workspace bundle verified (preview mode — D1 binding unavailable).');
  });

  it('surfaces import validation errors from the API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, edition: 'community', features: [] }))
      .mockResolvedValueOnce(response({ success: false, message: 'Checksum mismatch' }, 400));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpenCorePortability());
    act(() => result.current.setBundleJson('{"version":1}'));

    await act(async () => result.current.handleImportWorkspace());

    expect(result.current.notice).toBe('Checksum mismatch');
    expect(result.current.isBusy).toBe(false);
  });
});
