import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

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
vi.mock('@/components/video-preview', () => ({
  VideoPreview: ({ status }: { status: string }) => <div data-testid="video-preview">{status}</div>,
}));

// Mock Supabase
const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

const mockSupabase = {
  auth: {
    getSession: mockGetSession,
  },
  from: mockFrom,
};

// Chain setup
mockFrom.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ single: mockSingle });

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
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
    mockGetSession.mockResolvedValue({ data: { session: null } });

    // In a server component test, we call the function directly
    try {
        await Page({ params: Promise.resolve({ id: '123' }) });
    } catch (e) {
        // redirect throws an error in Next.js, we catch it here or expect it
    }

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('calls notFound if campaign not found', async () => {
    const { notFound } = await import('next/navigation');
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockSingle.mockResolvedValue({ data: null });

    try {
        await Page({ params: Promise.resolve({ id: '123' }) });
    } catch (e) {
        // notFound throws
    }

    expect(notFound).toHaveBeenCalled();
  });

  it('renders campaign details when found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
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

    // Since Page is async, we await it.
    // However, testing library's `render` expects a React Element.
    // We can resolve the component first.
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
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
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
    expect(screen.getByText('Retry Generation')).toBeDefined();
    expect(screen.getByTestId('video-preview').textContent).toBe('failed');
  });
});
