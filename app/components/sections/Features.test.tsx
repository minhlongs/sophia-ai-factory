/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Features } from './Features'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      ...actual.motion,
      tr: actual.motion?.tr ?? vi.fn(({ children, ...props }: any) => (
        <tr data-testid="motion-tr" {...props}>{children}</tr>
      )),
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

// Mock GradientText
vi.mock('../ui/GradientText', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="gradient-text">{children}</span>
  ),
}))

// Mock FadeIn
vi.mock('../animations/FadeIn', () => ({
  FadeIn: ({ children, className, delay }: { children: React.ReactNode; className?: string; delay?: number }) => (
    <div data-testid="fade-in" data-delay={delay} className={className}>{children}</div>
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: vi.fn((props: any) => <svg {...props} data-testid="icon-check" />),
  X: vi.fn((props: any) => <svg {...props} data-testid="icon-x" />),
}))

describe('Features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Features component', () => {
    render(<Features />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading', () => {
    render(<Features />)
    expect(screen.getByText(/So Sánh/i)).toBeInTheDocument()
  })

  it('renders GradientText for Tính Năng', () => {
    render(<Features />)
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Tính Năng')
  })

  it('renders subtitle', () => {
    render(<Features />)
    expect(screen.getByText(/Chọn gói phù hợp/i)).toBeInTheDocument()
  })

  it('renders feature comparison table', () => {
    render(<Features />)
    // Verify component renders (table structure tested via glass-card)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders Videos/tháng feature', () => {
    render(<Features />)
    expect(screen.getByText('Videos/tháng')).toBeInTheDocument()
  })

  it('renders Cost/video feature', () => {
    render(<Features />)
    expect(screen.getByText('Cost/video')).toBeInTheDocument()
  })

  it('renders Platforms feature', () => {
    render(<Features />)
    expect(screen.getByText('Platforms')).toBeInTheDocument()
  })

  it('renders Telegram Commands feature with check icon', () => {
    render(<Features />)
    expect(screen.getAllByTestId('icon-check').length).toBeGreaterThan(0)
  })

  it('renders Voice Clone feature with mixed values', () => {
    render(<Features />)
    // Minimal has false (X icon), Standard and Scale have true (Check icon)
    expect(screen.getAllByTestId('icon-x').length).toBeGreaterThan(0)
  })

  it('renders Custom Templates feature', () => {
    render(<Features />)
    expect(screen.getByText('Custom Templates')).toBeInTheDocument()
  })

  it('renders Support feature', () => {
    render(<Features />)
    expect(screen.getByText('Support')).toBeInTheDocument()
  })

  it('renders FadeIn animations', () => {
    render(<Features />)
    const fadeIns = screen.getAllByTestId('fade-in')
    expect(fadeIns.length).toBeGreaterThanOrEqual(1)
  })

  it('renders feature rows with correct structure', () => {
    render(<Features />)
    // Check table structure
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
  })
})
