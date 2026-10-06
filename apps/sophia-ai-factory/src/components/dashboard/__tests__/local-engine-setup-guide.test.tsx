/**
 * Unit Test Suite: LocalEngineSetupGuide Component
 * Validates command rendering, copy-to-clipboard, and connection key retrieval/generation.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalEngineSetupGuide } from '../local-engine-setup-guide';

describe('LocalEngineSetupGuide', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders installation command and copies to clipboard', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/api-keys') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keys: [{ prefix: 'sk_live_12345678...' }] }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<LocalEngineSetupGuide />);

    expect(screen.getByText('curl -s https://platform.sophia.ai/install-m1.sh | bash')).toBeDefined();

    const copyBtn = screen.getByTitle('Copy install command');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'curl -s https://platform.sophia.ai/install-m1.sh | bash'
    );

    await waitFor(() => {
      expect(screen.getByText('sk_live_12345678...')).toBeDefined();
    });
  });

  it('handles generating a key when no active keys exist', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/v1/api-keys' && (!opts || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keys: [] }),
        });
      }
      if (url === '/api/v1/api-keys' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ fullKey: 'sk_live_newly_generated_999' }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<LocalEngineSetupGuide />);

    await waitFor(() => {
      expect(screen.getByText('No active connection key')).toBeDefined();
    });

    const generateBtn = screen.getByText('Generate Key');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('sk_live_newly_generated_999')).toBeDefined();
    });

    const copyKeyBtn = screen.getByTitle('Copy API key');
    fireEvent.click(copyKeyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sk_live_newly_generated_999');
  });
});
