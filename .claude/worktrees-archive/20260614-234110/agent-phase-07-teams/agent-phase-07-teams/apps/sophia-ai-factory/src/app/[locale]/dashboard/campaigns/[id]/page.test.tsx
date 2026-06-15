import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

// Mock modules
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock VideoPreview component
vi.mock('@/forest/components/video-preview', () => ({
  VideoPreview: ({ status }: { status: string }) => <div data-testid="video-preview">{status}</div>,
}));

// Mock next/dynamic to bypass lazy loading in tests.
// Returns a simple component matching VideoPreview mock interface.
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    return function DynamicVideoPreview(props: { status: string }) {
      return <div data-testid="video-preview">{props.status}</div>;
    };
  },
}));

// Mock Better Auth session and DB client
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

const mockDb = {
  from: mockFrom,
};

// Chain setup: from().select().eq().eq().single()
mockFrom.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ eq: mockEq });
// eq is called twice, both times should return an object with eq() method
mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });

vi.mock('@/seed/db/client', () => ({
  getD1Client: vi.fn(async () => mockDb),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getFormatter: vi.fn().mockResolvedValue({
    dateTime: (d: Date) => d.toISOString(),
    number: (n: number) => String(n),
    relativeTime: (d: Date) => d.toISOString(),
  }),
}));

// Mock environment variables just in case
const originalEnv = process.env;

describe('CampaignDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('redirects to login if no session', async () => {
    const { redirect } = await import('next/navigation');
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    // In a server component test, we call the function directly
    try {
        await Page({ params: Promise.resolve({ id: '123' }) });
    } catch {
        // redirect throws an error in Next.js, we catch it here or expect it
    }

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('calls notFound if campaign not found', async () => {
    const { notFound } = await import('next/navigation');
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com', role: 'user' });
    mockSingle.mockResolvedValue({ data: null });

    try {
        await Page({ params: Promise.resolve({ id: '123' }) });
    } catch {
        // notFound throws
    }

    expect(notFound).toHaveBeenCalled();
  });

  it('renders campaign details when found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com', role: 'user' });
    const mockCampaign = {
      id: 'c1',
      title: 'Test Campaign',
      status: 'completed',
      created_at: '2023-01-01',
      updated_at: '2023-01-02',
      video_url: 'http://vid.url',
      thumbnail_url: 'http://thumb.url',
      progress: 100,
      audience: 'Gamers',
      topic: 'New Game',
      script_content: { scenes: [{ narration: 'Scene 1', visual_description: 'Visual 1' }] }
    };
    mockSingle.mockResolvedValue({ data: mockCampaign });

    // Server component: resolve async, then render
    const Component = await Page({ params: Promise.resolve({ id: 'c1' }) });

    render(Component);

    expect(screen.getByText('Test Campaign')).toBeDefined();
    // 'Gamers' appears twice (header metadata and sidebar details), so we use getAllByText
    expect(screen.getAllByText('Gamers')[0]).toBeDefined();
    expect(screen.getByText('New Game')).toBeDefined();
    expect(screen.getByTestId('video-preview').textContent).toBe('completed');
    // 'Scene 1' might appear multiple times (header and content), so we use getAllByText
    expect(screen.getAllByText('Scene 1')[0]).toBeDefined();
  });

  it('renders correctly for failed state', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'test@example.com', role: 'user' });
    const mockCampaign = {
      id: 'c1',
      title: 'Failed Campaign',
      status: 'failed',
      created_at: '2023-01-01',
      updated_at: '2023-01-02',
      progress: 50,
      script_content: {}
    };
    mockSingle.mockResolvedValue({ data: mockCampaign });

    const Component = await Page({ params: Promise.resolve({ id: 'c1' }) });
    render(Component);

    expect(screen.getByText('Failed Campaign')).toBeDefined();
    expect(screen.getByText('retry')).toBeDefined();
    expect(screen.getByTestId('video-preview').textContent).toBe('failed');
  });
});
