/**
 * Unit Test Suite: SettingsJurisdictionPicker
 *
 * Covers the geo declaration round-trip: loading the persisted region, sending
 * it back through `PUT /api/v1/settings/geo` with the CSRF header, surfacing
 * API errors instead of a false success, and clearing the declaration to null.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import enMessages from '../../../../messages/en.json';

vi.mock('@/seed/security/use-csrf-token', () => ({
  useCsrfToken: () => ({ 'x-csrf-token': 'csrf-token' }),
}));

/**
 * The component reads its copy from the shared `cryptoCompliance` namespace.
 * Returning the real English strings (rather than the raw key) keeps the
 * bilingual contract observable: if a namespace key is renamed or lost, these
 * assertions fail on the missing sentence instead of silently passing.
 */
const EN = enMessages.cryptoCompliance;

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    if (namespace !== 'cryptoCompliance') return key;
    const value = (EN as unknown as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : key;
  },
  useLocale: () => 'en',
}));

import { SettingsJurisdictionPicker } from '../settings-jurisdiction-picker';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Deferred until `resolve`, so the in-flight state is observable. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const UNDECLARED_VALUE = '';

/** The region control, narrowed for value/disabled assertions. */
function getSelect(): HTMLSelectElement {
  return screen.getByRole('combobox') as unknown as HTMLSelectElement;
}

function getSaveButton(): HTMLButtonElement {
  return screen.getAllByRole('button')[0] as HTMLButtonElement;
}

function getFeedback(): string {
  return screen.getByTestId('jurisdiction-feedback').textContent ?? '';
}

function stubFetch(handlers: {
  get?: (url: string) => Promise<Response> | Response;
  put?: (url: string, init: RequestInit) => Promise<Response> | Response;
}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/v1/settings/geo' && init?.method === 'PUT') {
      return Promise.resolve(handlers.put?.(url, init) ?? response({ namespace: 'geo', value: {} }));
    }
    if (url === '/api/v1/settings/geo') {
      return Promise.resolve(handlers.get?.(url) ?? response({ namespace: 'geo', value: {} }));
    }
    return Promise.reject(new Error(`Unknown url: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('SettingsJurisdictionPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the loading state, then shows the declared region', async () => {
    const fetchMock = stubFetch({
      get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'SG' } }),
    });

    render(<SettingsJurisdictionPicker />);

    expect(screen.getByText('Loading declared region...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDefined();
    });

    const select = getSelect();
    expect(select.value).toBe('SG');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/settings/geo');
  });

  it('warns that undeclared regions block all regulated content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ namespace: 'geo', value: {} })));
    render(<SettingsJurisdictionPicker />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    expect(screen.getByTestId('jurisdiction-undeclared-warning').textContent).toContain(
      'ALL crypto and financial trading content',
    );
  });

  it('saves a newly selected region with the CSRF header and exact body', async () => {
    const putCalls: Array<{ url: string; init: RequestInit }> = [];
    stubFetch({
      get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'SG' } }),
      put: (url, init) => {
        putCalls.push({ url, init });
        return response({ namespace: 'geo', value: { targetJurisdiction: 'US' } });
      },
    });

    render(<SettingsJurisdictionPicker />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'US' } });
    fireEvent.click(screen.getByText('Save Jurisdiction'));

    await waitFor(() => {
      expect(getFeedback()).toBe('Saved!');
    });

    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].url).toBe('/api/v1/settings/geo');
    expect(putCalls[0].init.method).toBe('PUT');
    expect(putCalls[0].init.headers).toEqual({
      'x-csrf-token': 'csrf-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(putCalls[0].init.body))).toEqual({ targetJurisdiction: 'US' });

    // The select is re-synced from the server's authoritative response.
    expect(getSelect().value).toBe('US');
  });

  it('surfaces the API error and hides any success message', async () => {
    stubFetch({
      get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'SG' } }),
      put: () => response({ error: 'Validation failed', message: 'Unsupported region code' }, 422),
    });

    render(<SettingsJurisdictionPicker />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EU' } });
    fireEvent.click(screen.getByText('Save Jurisdiction'));

    await waitFor(() => {
      expect(getFeedback()).toContain(
        'Unsupported region code',
      );
    });
    expect(getFeedback()).toContain('HTTP 422');
    expect(getFeedback()).not.toContain(
      'Saved!',
    );
    // Selection is left untouched so the tenant can retry without re-choosing.
    expect(getSelect().value).toBe('EU');
  });

  it('sends null when the undeclared option is chosen', async () => {
    const putCalls: Array<{ url: string; init: RequestInit }> = [];
    stubFetch({
      get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'US' } }),
      put: (url, init) => {
        putCalls.push({ url, init });
        return response({ namespace: 'geo', value: {} });
      },
    });

    render(<SettingsJurisdictionPicker />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: UNDECLARED_VALUE },
    });
    fireEvent.click(screen.getByText('Save Jurisdiction'));

    await waitFor(() => {
      expect(getFeedback()).toBe('Saved!');
    });

    expect(JSON.parse(String(putCalls[0].init.body))).toEqual({ targetJurisdiction: null });
    expect(getSelect().value).toBe(UNDECLARED_VALUE);
  });

  it('disables the control while the save request is in flight', async () => {
    const gate = deferred<Response>();
    stubFetch({
      get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'US' } }),
      put: () => gate.promise,
    });

    render(<SettingsJurisdictionPicker />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    fireEvent.click(screen.getByText('Save Jurisdiction'));

    const button = getSaveButton();
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Saving...');
    expect(getSelect().disabled).toBe(true);

    gate.resolve(response({ namespace: 'geo', value: { targetJurisdiction: 'US' } }));

    await waitFor(() => {
      expect(getFeedback()).toBe('Saved!');
    });
    expect(getSaveButton().disabled).toBe(false);
  });

  it('shows the region the gate applies for an unrecognised stored code', async () => {
    stubFetch({
      get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'BR' } }),
    });

    render(<SettingsJurisdictionPicker />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    // 'BR' is not a code the gate distinguishes. The gate governs it by US
    // rules, so the picker shows US rather than claiming regulated content is
    // blocked when it is not.
    expect(getSelect().value).toBe('US');
    expect(screen.queryByTestId('jurisdiction-undeclared-warning')).toBeNull();
  });

  it('reports a load failure without crashing the form', async () => {
    stubFetch({ get: () => response({ error: 'Unauthorized' }, 401) });

    render(<SettingsJurisdictionPicker />);

    await waitFor(() => {
      expect(getFeedback()).toBe(
        'Could not load the declared region. You can still select and save one.',
      );
    });
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('offers exactly the five supported regions plus the undeclared choice', async () => {
    stubFetch({ get: () => response({ namespace: 'geo', value: {} }) });
    render(<SettingsJurisdictionPicker />);

    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option'));
    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual([
      'US',
      'EU',
      'SG',
      'JP',
      'VN',
      UNDECLARED_VALUE,
    ]);
  });

  it('warns next to the blocked option when Vietnam is selected', async () => {
    stubFetch({ get: () => response({ namespace: 'geo', value: { targetJurisdiction: 'US' } }) });
    render(<SettingsJurisdictionPicker />);
    await waitFor(() => expect(screen.getByRole('combobox')).toBeDefined());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'VN' } });

    await waitFor(() => {
      expect(screen.getByTestId('jurisdiction-blocked-warning').textContent).toContain(
        'refuse to publish crypto promo content to a Vietnam audience',
      );
    });
    // Still selectable — a truthful declaration is permitted, only warned about.
    expect(getSelect().value).toBe('VN');
    expect(getSaveButton().disabled).toBe(false);
  });
});
