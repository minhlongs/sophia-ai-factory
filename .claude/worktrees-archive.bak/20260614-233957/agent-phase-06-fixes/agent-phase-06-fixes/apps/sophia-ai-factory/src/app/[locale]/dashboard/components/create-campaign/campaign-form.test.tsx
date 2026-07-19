import React from 'react';
import { describe, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CampaignForm } from './campaign-form';

// Mock dependencies
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/seed/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader" />,
  Sparkles: () => <div data-testid="sparkles" />,
}));

vi.mock('@/forest/components/UpgradeBanner', () => ({
  UpgradeBanner: () => <div data-testid="upgrade-banner" />,
}));

describe('CampaignForm Coverage Reproduction', () => {
  it('renders without crashing', () => {
    // Minimal props
    const props = {
      selectedTemplate: {
        id: 'test',
        name: 'Test Template',
        description: 'Test',
        category: 'product' as const,
        icon: 'test',
        defaults: {
            title: 'Test Title',
            tone: 'professional' as const,
            audience: 'General',
            suggestedDuration: 60,
            platform: ['youtube'],
            keywords: []
        },
        prompts: {
            system: 'sys',
            user: 'user'
        }
      },
      formData: {
        title: '',
        topic: '',
        audience: '',
      },
      setFormData: vi.fn(),
      selectedPlatforms: [],
      setSelectedPlatforms: vi.fn(),
      onSubmit: vi.fn(),
      loading: false,
      error: null,
      upgradeRequired: { required: false, tier: 'BASIC' as const },
      onChangeTemplate: vi.fn(),
    };

    render(<CampaignForm {...props} />);
  });
});
