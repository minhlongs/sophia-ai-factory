import { act, renderHook } from '@testing-library/react';
import type { FormEvent, KeyboardEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FreeModalState } from './types';
import { useFreeRedemptionDialog } from './use-free-redemption-dialog';
import type { UseFreeRedemptionDialogParams } from './use-free-redemption-dialog';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const tLabel = ((key: string) => `coupon.${key}`) as UseFreeRedemptionDialogParams['tLabel'];

function modal(overrides: Partial<FreeModalState> = {}): FreeModalState {
  return {
    open: true,
    code: 'FREE100',
    discountType: 'free_full',
    discountValue: 100,
    appliesToTier: null,
    ...overrides,
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formEvent(): FormEvent<HTMLFormElement> {
  return { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
}

function keyEvent(key: string, shiftKey = false): KeyboardEvent<HTMLDivElement> {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLDivElement>;
}

describe('useFreeRedemptionDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('closes on Escape and removes the keyboard listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose, tLabel }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps focus in both directions and ignores unrelated keys or absent controls', () => {
    const { result, unmount } = renderHook(() =>
      useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }),
    );

    const nonTab = keyEvent('Enter');
    act(() => result.current.handleFocusTrap(nonTab));
    expect(nonTab.preventDefault).not.toHaveBeenCalled();

    const noDialog = keyEvent('Tab');
    act(() => result.current.handleFocusTrap(noDialog));
    expect(noDialog.preventDefault).not.toHaveBeenCalled();

    const dialog = document.createElement('div');
    dialog.innerHTML = '<button id="first">First</button><button disabled>Disabled</button><input id="last" />';
    document.body.appendChild(dialog);
    act(() => {
      result.current.dialogRef.current = dialog;
    });

    const first = dialog.querySelector('#first') as HTMLButtonElement;
    const last = dialog.querySelector('#last') as HTMLInputElement;

    first.focus();
    const shiftTab = keyEvent('Tab', true);
    act(() => result.current.handleFocusTrap(shiftTab));
    expect(shiftTab.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(last);

    last.focus();
    const tab = keyEvent('Tab');
    act(() => result.current.handleFocusTrap(tab));
    expect(tab.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(first);

    unmount();
    dialog.remove();
  });

  it('focuses the email field and skips the request for blank input', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }));
    const emailInput = document.createElement('input');
    document.body.appendChild(emailInput);
    act(() => {
      result.current.emailRef.current = emailInput;
    });

    const event = formEvent();
    await act(async () => result.current.handleSubmit(event));

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(emailInput);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
    emailInput.remove();
  });

  it('trims submitted fields and defaults an unspecified tier to BASIC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }));
    act(() => {
      result.current.setEmail('  user@example.com  ');
      result.current.setName('  Ada Lovelace  ');
    });

    await act(async () => result.current.handleSubmit(formEvent()));

    expect(fetchMock).toHaveBeenCalledWith('/api/promo/redeem-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'FREE100', email: 'user@example.com', fullName: 'Ada Lovelace', tier: 'BASIC' }),
    });
    expect(result.current.done).toBe(true);
  });

  it('uses the selected tier and omits a blank optional name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useFreeRedemptionDialog({
        modal: modal({ appliesToTier: 'PREMIUM' }),
        onClose: vi.fn(),
        tLabel,
      }),
    );
    act(() => {
      result.current.setEmail('user@example.com');
      result.current.setName('   ');
    });

    await act(async () => result.current.handleSubmit(formEvent()));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ code: 'FREE100', email: 'user@example.com', tier: 'PREMIUM' });
  });

  it('surfaces API errors and resets the submitting state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Promo expired' }, 410)));
    const { result } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }));
    act(() => result.current.setEmail('user@example.com'));

    await act(async () => result.current.handleSubmit(formEvent()));

    expect(result.current.error).toBe('Promo expired');
    expect(result.current.submitting).toBe(false);
    expect(result.current.done).toBe(false);
  });

  it('uses the translated fallback when a failed API response has no error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 503)));
    const { result } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }));
    act(() => result.current.setEmail('user@example.com'));

    await act(async () => result.current.handleSubmit(formEvent()));

    expect(result.current.error).toBe('pricing.error.redemption_failed');
    expect(result.current.submitting).toBe(false);
  });

  it('reports network and response parsing failures with the coupon translation', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('not-json'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }));
    act(() => result.current.setEmail('user@example.com'));

    await act(async () => result.current.handleSubmit(formEvent()));
    expect(result.current.error).toBe('coupon.network_error');
    expect(result.current.submitting).toBe(false);

    await act(async () => result.current.handleSubmit(formEvent()));
    expect(result.current.error).toBe('coupon.network_error');
    expect(result.current.submitting).toBe(false);
  });

  it('redirects after the success delay when the API returns a magic link', async () => {
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    try {
      Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
      vi.useFakeTimers();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, magicLink: '/claim/free' })));
      const { result, unmount } = renderHook(() => useFreeRedemptionDialog({ modal: modal(), onClose: vi.fn(), tLabel }));
      try {
        act(() => result.current.setEmail('user@example.com'));

        await act(async () => result.current.handleSubmit(formEvent()));
        expect(result.current.done).toBe(true);
        await act(async () => vi.advanceTimersByTimeAsync(2_000));
        expect((window.location as unknown as { href: string }).href).toBe('/claim/free');
      } finally {
        unmount();
      }
    } finally {
      vi.useRealTimers();
      if (locationDescriptor) Object.defineProperty(window, 'location', locationDescriptor);
    }
  });
});
