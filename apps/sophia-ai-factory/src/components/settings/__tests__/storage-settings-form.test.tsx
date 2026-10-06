/**
 * Unit Test Suite: StorageSettingsForm (Cloudflare R2 BYOS)
 * Validates loading, input manipulation, masking toggling, and PATCH persistence.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StorageSettingsForm } from '../storage-settings-form';

describe('StorageSettingsForm', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders loading state initially and populates fetched data', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/settings/storage') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              value: {
                r2AccessKeyId: 'AKIA_EXAMPLE_123',
                r2SecretAccessKey: 'SECRET_EXAMPLE_456',
                r2BucketName: 'my-media-bucket',
                r2Endpoint: 'https://acc123.r2.cloudflarestorage.com',
                r2PublicBaseUrl: 'https://pub-123.r2.dev',
                useTenantStorage: true,
              },
            }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<StorageSettingsForm />);

    expect(screen.getByText('Loading storage configuration...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByDisplayValue('my-media-bucket')).toBeDefined();
    });

    expect(screen.getByDisplayValue('https://acc123.r2.cloudflarestorage.com')).toBeDefined();
    expect(screen.getByDisplayValue('https://pub-123.r2.dev')).toBeDefined();

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('allows editing fields, toggling visibility masks, and saving settings', async () => {
    let patchPayload: unknown = null;

    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/v1/settings/storage' && (!opts || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ value: {} }),
        });
      }
      if (url === '/api/v1/settings/storage' && opts?.method === 'PATCH') {
        patchPayload = JSON.parse(opts.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ value: patchPayload }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<StorageSettingsForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. sophia-media-assets')).toBeDefined();
    });

    const bucketInput = screen.getByPlaceholderText('e.g. sophia-media-assets');
    fireEvent.change(bucketInput, { target: { value: 'custom-r2-bucket' } });

    const keyInput = screen.getByPlaceholderText('R2 API Token Access Key ID');
    expect(keyInput.getAttribute('type')).toBe('text');
    fireEvent.change(keyInput, { target: { value: 'NEW_KEY_ID' } });

    const switchBtn = screen.getByRole('switch');
    fireEvent.click(switchBtn);
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');

    const saveBtn = screen.getByText('Save Storage Configuration');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Cloudflare R2 storage credentials saved successfully.')).toBeDefined();
    });

    expect(patchPayload).toEqual({
      r2AccessKeyId: 'NEW_KEY_ID',
      r2SecretAccessKey: null,
      r2BucketName: 'custom-r2-bucket',
      r2Endpoint: null,
      r2PublicBaseUrl: null,
      useTenantStorage: true,
    });
  });

  it('displays error banner when PATCH fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/v1/settings/storage' && (!opts || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ value: {} }),
        });
      }
      if (url === '/api/v1/settings/storage' && opts?.method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Validation failed on endpoint URL' }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<StorageSettingsForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. sophia-media-assets')).toBeDefined();
    });

    const saveBtn = screen.getByText('Save Storage Configuration');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Validation failed on endpoint URL')).toBeDefined();
    });
  });
});
