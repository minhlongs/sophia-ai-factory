import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ValidationReceipt } from '@/tree/byok/validation-receipt-types';
import { ValidationReceiptCard } from '@/tree/components/setup-wizard/validation-receipt-card';
import { ApiKeysStep } from '@/tree/components/setup-wizard/steps/api-keys-step';
import { SetupWizardPage } from '@/tree/components/setup-wizard/steps/index';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => {
    const fullKey = ns ? `${ns}.${key}` : key;
    const dict: Record<string, string> = {
      'setupWizard.apiKeys.title': 'AI Service Configuration',
      'setupWizard.apiKeys.subtitle': 'Enter API keys for the AI services powering Sophia.',
      'setupWizard.apiKeys.fastTrack.badge': '1-Key Fast-Track',
      'setupWizard.apiKeys.fastTrack.title': 'Start with just 1 OpenRouter key to unlock AI campaigns',
      'setupWizard.apiKeys.fastTrack.description': 'Tiered routing cuts LLM spend by 55-70%.',
      'setupWizard.apiKeys.fastTrack.optionalSectionTitle': 'Optional Add-ons: Native Voice & Avatar Keys',
      'setupWizard.apiKeys.openrouter.label': 'OpenRouter API Key (LLM)',
      'setupWizard.apiKeys.openrouter.placeholder': 'sk-or-...',
      'setupWizard.apiKeys.openrouter.help': 'Get your key at openrouter.ai/keys',
      'setupWizard.apiKeys.receipt.title': 'Zero-Execution Key Validation Receipt',
      'setupWizard.apiKeys.receipt.capJsonSchema': 'JSON Schema',
      'setupWizard.apiKeys.receipt.capToolCall': 'Tool Calling',
      'setupWizard.apiKeys.receipt.capVision': 'Vision',
      'setupWizard.apiKeys.receipt.latencyLabel': 'Latency',
      'setupWizard.apiKeys.receipt.budgetWithin': 'Remaining budget',
      'setupWizard.apiKeys.receipt.budgetNoCap': 'No monthly spend cap set',
      'setupWizard.apiKeys.receipt.budgetExhausted': 'Monthly budget cap reached',
      'setupWizard.apiKeys.receipt.budgetCooldown': 'Cooldown active',
      'setupWizard.apiKeys.receipt.spentThisMonth': 'Spent this month',
      'setupWizard.actions.next': 'Continue',
    };
    return dict[fullKey] ?? key;
  },
}));

const BASE_RECEIPT: ValidationReceipt = {
  provider: 'openrouter',
  maskedKey: 'sk-or-...9f2a',
  checkedAtUnix: 1_760_000_000,
  capabilities: ['json_schema', 'tool_call', 'vision'],
  budget: { monthlyBudgetUsd: 25, monthSpentUsd: 4.25, cooldownUntil: null },
  verdict: { outcome: 'within_budget', remainingUsd: 20.75 },
};

const DEFAULT_CONFIG = {
  OPENROUTER_API_KEY: 'sk-or-v1-valid-test-key',
  ANTHROPIC_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  DID_API_KEY: '',
  MUAPI_API_KEY: '',
  REPLICATE_API_KEY: '',
  FAL_API_KEY: '',
};

describe('1-Key Fast-Track Banner & ValidationReceiptCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Fast-Track banner, OpenRouter receipt capabilities, latency, and spend', () => {
    render(
      <ApiKeysStep
        config={DEFAULT_CONFIG}
        updateConfig={vi.fn()}
        verifyKey={vi.fn().mockResolvedValue(true)}
        status={{ OPENROUTER_API_KEY: 'valid' }}
        errors={{}}
        latencies={{ OPENROUTER_API_KEY: 142 }}
        receipts={{ OPENROUTER_API_KEY: BASE_RECEIPT }}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('1-Key Fast-Track')).toBeDefined();
    expect(screen.getByText('Start with just 1 OpenRouter key to unlock AI campaigns')).toBeDefined();
    expect(screen.getByText('Optional Add-ons: Native Voice & Avatar Keys')).toBeDefined();
    expect(screen.getByText('Zero-Execution Key Validation Receipt')).toBeDefined();
    expect(screen.getByText('sk-or-...9f2a')).toBeDefined();
    expect(screen.getByText('JSON Schema')).toBeDefined();
    expect(screen.getByText('Tool Calling')).toBeDefined();
    expect(screen.getByText('Vision')).toBeDefined();
    expect(screen.getByText('142ms')).toBeDefined();
    expect(screen.getByText('$4.25 / $25.00')).toBeDefined();
    expect(screen.getByText('Remaining budget: $20.75')).toBeDefined();
  });

  it('renders no-cap, exhausted, and cooldown verdicts accurately', () => {
    const { rerender } = render(
      <ValidationReceiptCard
        receipt={{
          ...BASE_RECEIPT,
          budget: { monthlyBudgetUsd: null, monthSpentUsd: 1.5, cooldownUntil: null },
          verdict: { outcome: 'no_cap_set' },
        }}
      />,
    );
    expect(screen.getByText('No monthly spend cap set')).toBeDefined();

    rerender(
      <ValidationReceiptCard
        receipt={{
          ...BASE_RECEIPT,
          verdict: { outcome: 'budget_exhausted', remainingUsd: 0 },
        }}
      />,
    );
    expect(screen.getByText('Monthly budget cap reached')).toBeDefined();

    rerender(
      <ValidationReceiptCard
        receipt={{
          ...BASE_RECEIPT,
          verdict: { outcome: 'cooldown_active', resumesAtUnix: 1_760_000_600 },
        }}
      />,
    );
    expect(screen.getByText('Cooldown active')).toBeDefined();
  });

  it('captures receipt from /api/setup-wizard/validate-key in SetupWizardPage flow', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/setup-wizard/validate-key') {
        return {
          ok: true,
          json: async () => ({ valid: true, latencyMs: 98, receipt: BASE_RECEIPT }),
        };
      }
      if (url === '/api/user/byok') {
        return { ok: true, json: async () => ({ providers: [] }) };
      }
      if (url === '/api/user/profile') {
        return { ok: true, json: async () => ({ email: 'ceo@sophia.vn' }) };
      }
      return { ok: true, json: async () => ({ tier: 'PREMIUM', subscriptionActive: true }) };
    }) as unknown as typeof fetch;

    render(<SetupWizardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu thiết lập \/ Get Started/i }));
    await waitFor(() => expect(screen.getByText(/Account & Workspace/i)).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));

    await waitFor(() => expect(screen.getByText('1-Key Fast-Track')).toBeDefined());
    const openRouterInput = screen.getByLabelText(/OpenRouter API Key/i);
    fireEvent.change(openRouterInput, { target: { value: 'sk-or-v1-live-probe' } });
    fireEvent.click(screen.getAllByText('Verify')[0]);

    await waitFor(() => {
      expect(screen.getByText('Zero-Execution Key Validation Receipt')).toBeDefined();
      expect(screen.getByText('sk-or-...9f2a')).toBeDefined();
      expect(screen.getByText('Tool Calling')).toBeDefined();
    });
  });
});
