// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrandDomainsConsole } from '../brand-domains-console';
import type { BrandDomainIdentity, TechnicalRuntimeIdentity } from '@/seed/domain';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const SAMPLE_IDENTITY: TechnicalRuntimeIdentity = {
  workerName: 'sophia-ai-factory',
  accountId: 'f691e83094f776311a1bfe3f8b126f1c',
  accountSubdomain: 'agencyos-openclaw',
  technicalHostname: 'sophia-ai-factory.agencyos-openclaw.workers.dev',
  technicalOrigin: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
  deploymentSha: '06cf212d',
  environment: 'production',
};

const SAMPLE_DOMAIN: BrandDomainIdentity = {
  id: 'dom-1',
  hostname: 'studio.acme.io',
  cloudflareZoneId: 'z'.repeat(32),
  workerName: 'sophia-ai-factory',
  tenantId: 'tenant-acme',
  status: 'PENDING',
  isCanonical: false,
  authPolicy: 'standard',
  checks: {
    ownershipVerified: true,
    cfZoneEligible: true,
    workerAttached: true,
    tlsVerified: true,
    authOriginVerified: true,
    accessPolicyVerified: true,
    tenantAuthVerified: true,
    noPublicBypassVerified: true,
    externalCallbacksReviewed: true,
    smokeVerified: true,
  },
  createdBy: 'founder-1',
  activatedBy: null,
  activatedAt: null,
  suspendedAt: null,
  createdAt: '2026-11-24T00:00:00Z',
  updatedAt: '2026-11-24T00:00:00Z',
};

describe('BrandDomainsConsole UI', () => {
  beforeEach(() => {
    document.cookie = 'csrf-token=test-csrf-123';
    vi.restoreAllMocks();
  });

  it('loads technical identity, domains, audit events, and sends CSRF token on POST & PATCH', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init || !init.method || init.method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            technicalIdentity: SAMPLE_IDENTITY,
            staticAllowedHosts: [SAMPLE_IDENTITY.technicalHostname],
            domains: [SAMPLE_DOMAIN],
            auditEvents: [
              {
                id: 'evt-1',
                domainId: 'dom-1',
                hostname: 'studio.acme.io',
                action: 'REGISTERED',
                actorId: 'founder-1',
                actorEmail: 'founder@sophia.test',
                detailsJson: '{}',
                createdAt: '2026-11-24T00:00:00Z',
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ domain: SAMPLE_DOMAIN }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BrandDomainsConsole />);

    await waitFor(() => {
      expect(screen.getAllByText('studio.acme.io').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(SAMPLE_IDENTITY.technicalOrigin)).toBeTruthy();

    // Register a new brand domain
    const hostnameInput = screen.getByPlaceholderText('hostnamePlaceholder');
    fireEvent.change(hostnameInput, { target: { value: 'app.brandtwo.io' } });
    fireEvent.click(screen.getByText('registerButton'));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect((postCall?.[1]?.headers as Record<string, string>)['x-csrf-token']).toBe('test-csrf-123');
    });

    // Toggle a readiness check checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find((c) => c[1]?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect((patchCall?.[1]?.headers as Record<string, string>)['x-csrf-token']).toBe('test-csrf-123');
    });

    // Trigger activate button
    fireEvent.click(screen.getByText('activateButton'));
    await waitFor(() => {
      const activateCall = fetchMock.mock.calls.find(
        (c) => c[1]?.method === 'PATCH' && String(c[1]?.body).includes('"activate"'),
      );
      expect(activateCall).toBeTruthy();
    });
  });

  it('preserves error banner when PATCH returns an error response', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init || !init.method || init.method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            technicalIdentity: SAMPLE_IDENTITY,
            staticAllowedHosts: [SAMPLE_IDENTITY.technicalHostname],
            domains: [SAMPLE_DOMAIN],
            auditEvents: [],
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Cannot uncheck readiness gates' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BrandDomainsConsole />);
    await waitFor(() => {
      expect(screen.getByText('studio.acme.io')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('rollbackButton'));
    await waitFor(() => {
      expect(screen.getByText('Cannot uncheck readiness gates')).toBeTruthy();
    });
  });
});
