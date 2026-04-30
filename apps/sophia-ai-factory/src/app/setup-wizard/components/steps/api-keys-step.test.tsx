/**
 * Basic rendering + interaction tests for ApiKeysStep.
 * Verifies all 5 provider fields render and verify callbacks fire correctly.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApiKeysStep } from './api-keys-step';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'title': 'AI Service Configuration',
      'subtitle': 'Enter API keys for the AI services powering Sophia.',
      'openrouter.label': 'OpenRouter API Key (LLM)',
      'openrouter.placeholder': 'sk-or-...',
      'openrouter.help': 'Get your key at openrouter.ai/keys',
      'elevenlabs.label': 'ElevenLabs API Key (Voice)',
      'elevenlabs.placeholder': 'sk_...',
      'elevenlabs.help': 'Get your key at elevenlabs.io/subscription',
      'did.label': 'D-ID API Key (Avatar)',
      'did.placeholder': 'Basic ...',
      'did.help': 'Get your key at studio.d-id.com/account-settings',
      'heygen.label': 'HeyGen API Key (AI Video)',
      'heygen.placeholder': 'NjY...',
      'heygen.help': 'Get your key at app.heygen.com/settings/api-keys',
      'muapi.label': 'MuAPI Key (Music/Audio)',
      'muapi.placeholder': 'mu_...',
      'muapi.help': 'Get your key at muapi.ai/dashboard/api-keys',
    };
    return translations[key] ?? key;
  },
}));

const defaultConfig = {
  OPENROUTER_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  DID_API_KEY: '',
  HEYGEN_API_KEY: '',
  MUAPI_API_KEY: '',
};

const defaultStatus: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'> = {
  OPENROUTER_API_KEY: 'idle',
  ELEVENLABS_API_KEY: 'idle',
  DID_API_KEY: 'idle',
  HEYGEN_API_KEY: 'idle',
  MUAPI_API_KEY: 'idle',
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
      />
    );
    expect(screen.getByText('AI Service Configuration')).toBeDefined();
    expect(screen.getByText('Enter API keys for the AI services powering Sophia.')).toBeDefined();
  });

  it('renders all 5 provider fields', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
      />
    );
    expect(screen.getByLabelText(/OpenRouter API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/ElevenLabs API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/D-ID API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/HeyGen API Key/i)).toBeDefined();
    expect(screen.getByLabelText(/MuAPI Key/i)).toBeDefined();
  });

  it('renders the HeyGen field with correct label', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
      />
    );
    expect(screen.getByLabelText(/HeyGen API Key/i)).toBeDefined();
  });

  it('calls updateConfig when user types in HeyGen field', () => {
    render(
      <ApiKeysStep
        config={defaultConfig}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
      />
    );
    const heygenInput = screen.getByLabelText(/HeyGen API Key/i);
    fireEvent.change(heygenInput, { target: { value: 'test-heygen-key' } });
    expect(mockUpdateConfig).toHaveBeenCalledWith('HEYGEN_API_KEY', 'test-heygen-key');
  });

  it('calls verifyKey with heygen provider when verify button clicked', async () => {
    const configWithKey = { ...defaultConfig, HEYGEN_API_KEY: 'test-key-123' };
    render(
      <ApiKeysStep
        config={configWithKey}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
      />
    );

    // HeyGen is the 4th verify button (0-indexed: 3)
    const verifyButtons = screen.getAllByText('Verify');
    expect(verifyButtons.length).toBe(5);
    fireEvent.click(verifyButtons[3]);
    expect(mockVerifyKey).toHaveBeenCalledWith('heygen', 'HEYGEN_API_KEY', 'test-key-123');
  });

  it('calls verifyKey with correct provider for each field', async () => {
    const configWithKeys = {
      OPENROUTER_API_KEY: 'key1',
      ELEVENLABS_API_KEY: 'key2',
      DID_API_KEY: 'key3',
      HEYGEN_API_KEY: 'key4',
      MUAPI_API_KEY: 'key5',
    };
    render(
      <ApiKeysStep
        config={configWithKeys}
        updateConfig={mockUpdateConfig}
        verifyKey={mockVerifyKey}
        status={defaultStatus}
        errors={{}}
      />
    );

    const verifyButtons = screen.getAllByText('Verify');
    expect(verifyButtons.length).toBe(5);

    fireEvent.click(verifyButtons[0]);
    expect(mockVerifyKey).toHaveBeenCalledWith('openrouter', 'OPENROUTER_API_KEY', 'key1');

    fireEvent.click(verifyButtons[1]);
    expect(mockVerifyKey).toHaveBeenCalledWith('elevenlabs', 'ELEVENLABS_API_KEY', 'key2');

    fireEvent.click(verifyButtons[2]);
    expect(mockVerifyKey).toHaveBeenCalledWith('d-id', 'DID_API_KEY', 'key3');

    fireEvent.click(verifyButtons[3]);
    expect(mockVerifyKey).toHaveBeenCalledWith('heygen', 'HEYGEN_API_KEY', 'key4');

    fireEvent.click(verifyButtons[4]);
    expect(mockVerifyKey).toHaveBeenCalledWith('muapi', 'MUAPI_API_KEY', 'key5');
  });
});
