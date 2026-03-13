/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pricing } from './Pricing'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      ...actual.motion,
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: any) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
    },
  }
})

// Mock Container
vi.mock('../ui/Container', () => ({
  Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="container">{children}</div>
  ),
}))

// Mock GlassCard
vi.mock('../ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="glass-card">{children}</div>
  ),
}))

// Mock Button
vi.mock('../ui/Button', () => ({
  Button: ({ children, onClick, className, variant }: any) => (
    <button data-testid="button" data-variant={variant} onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

// Mock GradientText
vi.mock('../ui/GradientText', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="gradient-text">{children}</span>
  ),
}))

// Mock FadeIn
vi.mock('../animations/FadeIn', () => ({
  FadeIn: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="fade-in" className={className}>{children}</div>
  ),
}))

// Mock StaggerContainer
vi.mock('../animations/StaggerContainer', () => ({
  StaggerContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="stagger-container" className={className}>{children}</div>
  ),
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: vi.fn((props: any) => <svg {...props} data-testid="icon-check" />),
  Star: vi.fn((props: any) => <svg {...props} data-testid="icon-star" />),
}))

// Mock formatCurrency
vi.mock('@/app/lib/utils', () => ({
  formatCurrency: (value: number) => `₫${value.toLocaleString()}`,
}))

// Mock document.getElementById
const mockScrollIntoView = vi.fn()
HTMLElement.prototype.scrollIntoView = mockScrollIntoView

describe('Pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScrollIntoView.mockClear()
  })

  it('renders Pricing component', () => {
    render(<Pricing />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading', () => {
    render(<Pricing />)
    expect(screen.getByText(/Bảng Giá/i)).toBeInTheDocument()
  })

  it('renders GradientText for Dịch Vụ', () => {
    render(<Pricing />)
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Dịch Vụ')
  })

  it('renders subtitle', () => {
    render(<Pricing />)
    expect(screen.getByText(/Chi phí đầu tư một lần/i)).toBeInTheDocument()
  })

  it('renders three pricing tiers', () => {
    render(<Pricing />)
    expect(screen.getAllByTestId('glass-card')).toHaveLength(3)
  })

  it('renders Minimal tier', () => {
    render(<Pricing />)
    expect(screen.getByText('Minimal')).toBeInTheDocument()
  })

  it('renders Standard tier with highlight', () => {
    render(<Pricing />)
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument()
  })

  it('renders Scale tier', () => {
    render(<Pricing />)
    expect(screen.getByText('Scale')).toBeInTheDocument()
  })

  it('renders pricing for Minimal tier', () => {
    render(<Pricing />)
    expect(screen.getByText('₫35,000,000')).toBeInTheDocument()
  })

  it('renders pricing for Standard tier', () => {
    render(<Pricing />)
    expect(screen.getByText('₫55,000,000')).toBeInTheDocument()
  })

  it('renders pricing for Scale tier', () => {
    render(<Pricing />)
    expect(screen.getByText('₫85,000,000')).toBeInTheDocument()
  })

  it('renders monthly cost estimates', () => {
    render(<Pricing />)
    // Check for monthly cost text pattern (multiple tiers)
    expect(screen.getAllByText(/AI usage estimated/i).length).toBeGreaterThan(0)
  })

  it('renders feature lists', () => {
    render(<Pricing />)
    expect(screen.getByText('1 YouTube channel setup')).toBeInTheDocument()
    expect(screen.getByText('3 YouTube channels')).toBeInTheDocument()
    expect(screen.getByText('5 YouTube channels')).toBeInTheDocument()
  })

  it('renders check icons for features', () => {
    render(<Pricing />)
    expect(screen.getAllByTestId('icon-check').length).toBeGreaterThan(0)
  })

  it('renders CTA buttons', () => {
    render(<Pricing />)
    expect(screen.getAllByTestId('button')).toHaveLength(3)
  })

  it('renders star icon for recommended tier', () => {
    render(<Pricing />)
    // Standard tier is highlighted with star
    const stars = screen.getAllByTestId('icon-star')
    expect(stars.length).toBeGreaterThan(0)
  })

  it('renders FadeIn animation', () => {
    render(<Pricing />)
    expect(screen.getByTestId('fade-in')).toBeInTheDocument()
  })

  it('renders StaggerContainer', () => {
    render(<Pricing />)
    expect(screen.getByTestId('stagger-container')).toBeInTheDocument()
  })
})
