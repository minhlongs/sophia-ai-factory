import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizardPage } from './index';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => {
    const fullKey = ns ? `${ns}.${key}` : key;
    const translations: Record<string, string> = {
      'setupWizard.stepper.welcome': 'Welcome',
      'setupWizard.stepper.credentials': 'Credentials',
      'setupWizard.stepper.systemCheck': 'System Check',
      'setupWizard.stepper.review': 'Review',
      'setupWizard.errors.emptyKey': 'API key cannot be empty',
      'setupWizard.errors.verificationFailed': 'Key verification failed',
      'setupWizard.errors.saveFailed': 'Failed to save configuration',
      'setupWizard.apiKeys.title': 'AI Service Configuration',
      'setupWizard.apiKeys.subtitle': 'Enter API keys for the AI services powering Sophia.',
      'setupWizard.actions.next': 'Continue',
      'actions.next': 'Continue',
      'next': 'Continue',
    };
    return translations[fullKey] ?? translations[key] ?? key;
  },
}));

describe('SetupWizardPage Multi-Step Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/user/byok') {
        return { ok: true, json: async () => ({ providers: ['openrouter'] }) };
      }
      if (url === '/api/user/profile') {
        return { ok: true, json: async () => ({ email: 'founder@media.agency' }) };
      }
      if (url === '/api/setup-wizard/readiness') {
        return {
          ok: true,
          json: async () => ({
            tier: 'PREMIUM',
            mcuBalance: 1000,
            subscriptionActive: true,
            ownerVerified: true,
            byokEncrypted: true,
            providersConfigured: ['openrouter'],
            providersReady: ['openrouter'],
            capabilities: ['SCRIPT_GENERATION'],
            readyForMissions: true,
            issues: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;
  });

  it('renders Step 1 (Welcome) initially and navigates to Step 2 (Account)', async () => {
    render(<SetupWizardPage />);

    expect(screen.getByText(/Welcome to Sophia AI Factory/i)).toBeDefined();
    const getStartedBtn = screen.getByRole('button', { name: /Bắt đầu thiết lập \/ Get Started/i });
    fireEvent.click(getStartedBtn);

    await waitFor(() => {
      expect(screen.getByText(/Account & Workspace \/ Tài khoản & Tổ chức/i)).toBeDefined();
    });
  });

  it('navigates from Step 2 to Step 3 (AI Keys)', async () => {
    render(<SetupWizardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu thiết lập \/ Get Started/i }));

    await waitFor(() => {
      expect(screen.getByText(/Account & Workspace/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/AI Service Configuration/i).length).toBeGreaterThan(0);
    });
  });

  it('navigates from Step 3 to Step 4 (Payments) and Step 5 (First Mission)', async () => {
    render(<SetupWizardPage />);
    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu thiết lập \/ Get Started/i }));
    // Step 2 -> Step 3
    await waitFor(() => expect(screen.getByText(/Account & Workspace/i)).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));

    // Step 3 -> Step 4
    await waitFor(() => expect(screen.getAllByText(/AI Service Configuration/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 4: Payments
    await waitFor(() => expect(screen.getByText(/Subscription & Capacity \/ Gói dịch vụ & Hạn mức/i)).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));

    // Step 5: First Mission
    await waitFor(() => expect(screen.getByText(/How Sophia Runs Your First Mission/i)).toBeDefined());
  });
});
