import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Affiliates } from './Affiliates'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      h2: actual.motion?.h2 ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <h2 data-testid="motion-h2" {...props}>{children}</h2>
      )),
      p: actual.motion?.p ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <p data-testid="motion-p" {...props}>{children}</p>
      )),
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
    },
    useInView: vi.fn(() => true),
  }
})

// Mock Container
vi.mock('../ui/Container', () => ({
  Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="container">{children}</div>
  ),
}))

// Mock GradientText
vi.mock('../ui/GradientText', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="gradient-text">{children}</span>
  ),
}))

// Mock GlassCard
vi.mock('../ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="glass-card">{children}</div>
  ),
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  // @ts-expect-error - Test mock type compatibility
  ExternalLink: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-external" />,
}))

describe('Affiliates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Affiliates component', () => {
    render(<Affiliates />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading with GradientText', () => {
    render(<Affiliates />)
    expect(screen.getByText(/Top/i)).toBeInTheDocument()
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Affiliate Programs')
  })

  it('renders subtitle', () => {
    render(<Affiliates />)
    expect(screen.getByText(/Các chương trình tiếp thị liên kết/i)).toBeInTheDocument()
  })

  it('renders CoinLedger program', () => {
    render(<Affiliates />)
    expect(screen.getByText('CoinLedger')).toBeInTheDocument()
    expect(screen.getByText('25% recurring')).toBeInTheDocument()
  })

  it('renders Jasper AI program', () => {
    render(<Affiliates />)
    expect(screen.getByText('Jasper AI')).toBeInTheDocument()
    expect(screen.getByText('30% recurring')).toBeInTheDocument()
  })

  it('renders beehiiv program', () => {
    render(<Affiliates />)
    expect(screen.getByText('beehiiv')).toBeInTheDocument()
    expect(screen.getAllByText('50% 12-months').length).toBeGreaterThanOrEqual(1)
  })

  it('renders NordVPN program', () => {
    render(<Affiliates />)
    expect(screen.getByText('NordVPN')).toBeInTheDocument()
    expect(screen.getByText('40-100% CPA')).toBeInTheDocument()
  })

  it('renders Pictory program', () => {
    render(<Affiliates />)
    expect(screen.getByText('Pictory')).toBeInTheDocument()
    expect(screen.getByText('20-50% recurring')).toBeInTheDocument()
  })

  it('renders Teachable program', () => {
    render(<Affiliates />)
    expect(screen.getByText('Teachable')).toBeInTheDocument()
    expect(screen.getByText('30-50% recurring')).toBeInTheDocument()
  })

  it('renders Webflow program', () => {
    render(<Affiliates />)
    expect(screen.getByText('Webflow')).toBeInTheDocument()
  })

  it('renders GetResponse program', () => {
    render(<Affiliates />)
    expect(screen.getByText('GetResponse')).toBeInTheDocument()
    expect(screen.getByText('33% recurring')).toBeInTheDocument()
  })

  it('renders Koinly program', () => {
    render(<Affiliates />)
    expect(screen.getByText('Koinly')).toBeInTheDocument()
  })

  it('renders CoinPanda program', () => {
    render(<Affiliates />)
    expect(screen.getByText('CoinPanda')).toBeInTheDocument()
    expect(screen.getByText('20-40% lifetime')).toBeInTheDocument()
  })

  it('renders 10 program cards', () => {
    render(<Affiliates />)
    const glassCards = screen.getAllByTestId('glass-card')
    expect(glassCards).toHaveLength(10)
  })

  it('renders external link icons', () => {
    render(<Affiliates />)
    const externals = screen.getAllByTestId('icon-external')
    expect(externals.length).toBeGreaterThanOrEqual(10)
  })

  it('renders motion heading', () => {
    render(<Affiliates />)
    const heading = screen.getByText(/Top/i)
    expect(heading).toBeInTheDocument()
  })

  it('renders motion subtitle', () => {
    render(<Affiliates />)
    const subtitle = screen.getByText(/Các chương trình tiếp thị/i)
    expect(subtitle).toBeInTheDocument()
  })
})
