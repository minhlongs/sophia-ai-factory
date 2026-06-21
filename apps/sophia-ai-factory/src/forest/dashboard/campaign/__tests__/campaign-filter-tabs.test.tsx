import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignFilterTabs } from '../campaign-filter-tabs';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/seed/components/ui/tabs', () => ({
  Tabs: ({ children, value }: any) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`tab-${value}`}>{children}</button>
  ),
}));

describe('CampaignFilterTabs', () => {
  it('renders all filter tabs', () => {
    render(<CampaignFilterTabs value="all" onChange={() => {}} />);
    expect(screen.getByTestId('tab-all')).toBeDefined();
    expect(screen.getByTestId('tab-draft')).toBeDefined();
    expect(screen.getByTestId('tab-completed')).toBeDefined();
    // check other tabs
    expect(screen.getByTestId('tab-queued')).toBeDefined();
    expect(screen.getByTestId('tab-processing_script')).toBeDefined();
    expect(screen.getByTestId('tab-processing_video')).toBeDefined();
    expect(screen.getByTestId('tab-failed')).toBeDefined();
  });

  it('sets active tab via data-value', () => {
    render(<CampaignFilterTabs value="processing_script" onChange={() => {}} />);
    const tabs = screen.getByTestId('tabs');
    expect(tabs.getAttribute('data-value')).toBe('processing_script');
  });
});
