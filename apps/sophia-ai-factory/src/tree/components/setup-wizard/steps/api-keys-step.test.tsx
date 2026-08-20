/**
 * Basic rendering + interaction tests for ApiKeysStep.
 * Verifies all 5 provider fields render and verify callbacks fire correctly.
 * Provider list: openrouter, anthropic, elevenlabs, d-id, muapi (heygen removed).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApiKeysStep } from '@/tree/components/setup-wizard/steps/api-keys-step';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'title': 'AI Service Configuration',
      'subtitle': 'Enter API keys for the AI services powering Sophia.',
      'openrouter.label': 'OpenRouter API Key (LLM)',
      'openrouter.placeholder': 'sk-or-...',
      'openrouter.help': 'Get your key at openrouter.ai/keys',
      'anthropic.label': 'Anthropic API Key (LLM)',
      'anthropic.placeholder': 'sk-ant-...',
      'anthropic.help': 'Get your key at console.anthropic.com/keys',
      'elevenlabs.label': 'ElevenLabs API Key (Voice)',
      'elevenlabs.placeholder': 'sk_...',
      'elevenlabs.help': 'Get your key at elevenlabs.io/subscription',
      'did.label': 'D-ID API Key (Avatar)',
      'did.placeholder': 'Basic ...',
      'did.help': 'Get your key at studio.d-id.com/account-settings',
      'muapi.label': 'MuAPI Key (Music/Audio)',
      'muapi.placeholder': 'mu_...',
      'muapi.help': 'Get your key at muapi.ai/dashboard/api-keys',
      'replicate.label': 'Replicate API Key (Video)',
      'replicate.placeholder': 'r8_...',
      'replicate.help': 'Get your key at replicate.com/account/api-tokens',
      'replicate.optionalBadge': 'Add later',
    };
    return translations[key] ?? key;
  },
}));

const defaultConfig = {
  OPENROUTER_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  DID_API_KEY: '',
  MUAPI_API_KEY: '',
  REPLICATE_API_KEY: '',
};

const defaultStatus: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'> = {
  OPENROUTER_API_KEY: 'idle',
  ANTHROPIC_API_KEY: 'idle',
  ELEVENLABS_API_KEY: 'idle',
  DID_API_KEY: 'idle',
  MUAPI_API_KEY: 'idle',
  REPLICATE_API_KEY: 'idle',
};

describe('ApiKeysStep', () => {
  const mockUpdateConfig = vi.fn();
  const mockVerifyKey = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByText('AI Service Configuration')).toBeDefined();
    expect(screen.getByText('Enter API keys for the AI services powering Sophia.')).toBeDefined();
  });

  it('renders all 6 provider fields', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/OpenRouter API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/Anthropic API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/ElevenLabs API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/D-ID API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/MuAPI Key/i)).toBeDefined();
    expect(screen.getByLabelText(/Replicate API Key/i)).toBeDefined();
  });

  it('does not render HeyGen field (removed from provider list)', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/HeyGen/i)).toBeNull();
  });

  it('renders the Anthropic field with correct label', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Anthropic API Key/i)).toBeDefined();
  });

  it('calls updateConfig when user types in Anthropic field', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );
    const anthropicInput = screen.getByLabelText(/Anthropic API Key/i);
    fireEvent.change(anthropicInput, { target: { value: 'sk-ant-test-key' } });
    expect(mockUpdateConfig).toHaveBeenCalledWith('ANTHROPIC_API_KEY', 'sk-ant-test-key');
  });

  it('calls verifyKey with anthropic provider when verify button clicked', async () => {
    const configWithKey = { ...defaultConfig, ANTHROPIC_API_KEY: 'sk-ant-test-123' };
    render(
      <ApiKeysStep
        config={configWithKey}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );

    // Render order: openrouter(0), elevenlabs(1), did(2), anthropic(3), muapi(4), replicate(5)
    const verifyButtons = screen.getAllByText('Verify');
    expect(verifyButtons.length).toBe(6);
    fireEvent.click(verifyButtons[3]);
    expect(mockVerifyKey).toHaveBeenCalledWith('anthropic', 'ANTHROPIC_API_KEY', 'sk-ant-test-123');
  });

  it('calls verifyKey with correct provider for each field', async () => {
    // Render order: openrouter(0), elevenlabs(1), did(2), anthropic(3), muapi(4), replicate(5)
    const configWithKeys = {
      OPENROUTER_API_KEY: 'key1',
      ELEVENLABS_API_KEY: 'key2',
      DID_API_KEY: 'key3',
      ANTHROPIC_API_KEY: 'key4',
      MUAPI_API_KEY: 'key5',
      REPLICATE_API_KEY: 'key6',
    };
    render(
      <ApiKeysStep
        config={configWithKeys}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
        onNext={vi.fn()}
      />
    );

    const verifyButtons = screen.getAllByText('Verify');
    expect(verifyButtons.length).toBe(6);

    fireEvent.click(verifyButtons[0]);
    expect(mockVerifyKey).toHaveBeenCalledWith('openrouter', 'OPENROUTER_API_KEY', 'key1');

    fireEvent.click(verifyButtons[1]);
    expect(mockVerifyKey).toHaveBeenCalledWith('elevenlabs', 'ELEVENLABS_API_KEY', 'key2');

    fireEvent.click(verifyButtons[2]);
    expect(mockVerifyKey).toHaveBeenCalledWith('d-id', 'DID_API_KEY', 'key3');

    fireEvent.click(verifyButtons[3]);
    expect(mockVerifyKey).toHaveBeenCalledWith('anthropic', 'ANTHROPIC_API_KEY', 'key4');

    fireEvent.click(verifyButtons[4]);
    expect(mockVerifyKey).toHaveBeenCalledWith('muapi', 'MUAPI_API_KEY', 'key5');

    fireEvent.click(verifyButtons[5]);
    expect(mockVerifyKey).toHaveBeenCalledWith('replicate', 'REPLICATE_API_KEY', 'key6');
  });
});
