import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AffiliateDiscovery } from './AffiliateDiscovery'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
    },
    useInView: vi.fn(() => true),
  }
})

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ExternalLink: vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-external" />),
  Tag: vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-tag" />),
  Percent: vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-percent" />),
}))

// Mock affiliate data
vi.mock('@/app/lib/affiliate-data', () => ({
  affiliatePrograms: [
    {
      id: '1',
      name: 'Test Program 1',
      category: 'AI Tools',
      commission: '30%',
      description: 'Test description 1',
      link: 'https://test.com/1',
      color: 'cyan' as const,
    },
    {
      id: '2',
      name: 'Test Program 2',
      category: 'Marketing',
      commission: '25%',
      description: 'Test description 2',
      link: 'https://test.com/2',
      color: 'purple' as const,
    },
    {
      id: '3',
      name: 'Test Program 3',
      category: 'Video',
      commission: '20%',
      description: 'Test description 3',
      link: 'https://test.com/3',
      color: 'pink' as const,
    },
  ],
}))

describe('AffiliateDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders AffiliateDiscovery component', () => {
    render(<AffiliateDiscovery />)
    // Section should render with heading
    expect(screen.getByText(/Auto-Discovery Affiliate Network/i)).toBeInTheDocument()
  })

  it('renders heading', () => {
    render(<AffiliateDiscovery />)
    expect(screen.getByText(/Auto-Discovery Affiliate Network/i)).toBeInTheDocument()
  })

  it('renders subtitle', () => {
    render(<AffiliateDiscovery />)
    expect(screen.getByText(/Access our curated ecosystem/i)).toBeInTheDocument()
  })

  it('renders affiliate program cards', () => {
    render(<AffiliateDiscovery />)
    expect(screen.getByText('Test Program 1')).toBeInTheDocument()
    expect(screen.getByText('Test Program 2')).toBeInTheDocument()
    expect(screen.getByText('Test Program 3')).toBeInTheDocument()
  })

  it('renders program categories', () => {
    render(<AffiliateDiscovery />)
    expect(screen.getByText('AI Tools')).toBeInTheDocument()
    expect(screen.getByText('Marketing')).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
  })

  it('renders commission badges', () => {
    render(<AffiliateDiscovery />)
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('renders program descriptions', () => {
    render(<AffiliateDiscovery />)
    expect(screen.getByText('Test description 1')).toBeInTheDocument()
    expect(screen.getByText('Test description 2')).toBeInTheDocument()
    expect(screen.getByText('Test description 3')).toBeInTheDocument()
  })

  it('renders Partner Program labels', () => {
    render(<AffiliateDiscovery />)
    const partnerLabels = screen.getAllByText('Partner Program')
    expect(partnerLabels.length).toBe(3)
  })

  it('renders View Details links', () => {
    render(<AffiliateDiscovery />)
    const viewDetails = screen.getAllByText('View Details')
    expect(viewDetails.length).toBe(3)
  })

  it('renders icons for each program', () => {
    render(<AffiliateDiscovery />)
    const tags = screen.getAllByTestId('icon-tag')
    expect(tags.length).toBeGreaterThanOrEqual(3)
    const percents = screen.getAllByTestId('icon-percent')
    expect(percents.length).toBeGreaterThanOrEqual(3)
  })

  it('renders external link icons', () => {
    render(<AffiliateDiscovery />)
    const externals = screen.getAllByTestId('icon-external')
    expect(externals.length).toBeGreaterThanOrEqual(3)
  })
})
