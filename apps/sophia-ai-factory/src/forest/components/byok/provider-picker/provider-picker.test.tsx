// i18n-namespace: byok.picker

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ByokProviderPicker, PROVIDER_MODELS } from './index';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ByokProviderPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<ByokProviderPicker onSelect={vi.fn()} />);
    expect(screen.getByRole('generic', { busy: true })).toBeDefined();
  });

  it('renders no_providers when empty array returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: [] }),
    }));
    render(<ByokProviderPicker onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('no_providers')).toBeDefined();
    });
  });

  it('exports valid provider models mapping', () => {
    expect(PROVIDER_MODELS.anthropic.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.openrouter.length).toBeGreaterThan(0);
  });
});
