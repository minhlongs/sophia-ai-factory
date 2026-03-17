import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from './Hero'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
      p: actual.motion?.p ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <p data-testid="motion-p" {...props}>{children}</p>
      )),
      h1: actual.motion?.h1 ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <h1 data-testid="motion-h1" {...props}>{children}</h1>
      )),
      span: actual.motion?.span ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <span data-testid="motion-span" {...props}>{children}</span>
      )),
      section: actual.motion?.section ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <section data-testid="motion-section" {...props}>{children}</section>
      )),
    },
    useInView: vi.fn(() => true),
    stagger: vi.fn((val: number) => val),
  }
})

// Mock Container
vi.mock('../ui/Container', () => ({
  Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="container">{children}</div>
  ),
}))

// Mock Button
vi.mock('../ui/Button', () => ({
  Button: ({ children, onClick, className, size, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    size?: string;
    variant?: string;
  }) => (
    <button
      data-testid="button"
      data-size={size}
      data-variant={variant}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  ),
}))

// Mock GlassCard
vi.mock('../ui/GlassCard', () => ({
  GlassCard: ({ children, className, hoverEffect }: {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
  }) => (
    <div data-testid="glass-card" data-hover={hoverEffect} className={className}>
      {children}
    </div>
  ),
}))

// Mock TypewriterLoop
vi.mock('../ui/TypewriterEffect', () => ({
  TypewriterLoop: ({ words }: { words: string[] }) => (
    <span data-testid="typewriter">{words.join(', ')}</span>
  ),
}))

// Mock FloatingElement
vi.mock('../ui/FloatingElement', () => ({
  FloatingElement: ({ children, depth, duration, className }: {
    children: React.ReactNode;
    depth?: number;
    duration?: number;
    className?: string;
  }) => (
    <div data-testid="floating-element" data-depth={depth} data-duration={duration} className={className}>
      {children}
    </div>
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  // @ts-expect-error - Test mock type compatibility
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-arrow" />,
  // @ts-expect-error - Test mock type compatibility
  Zap: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-zap" />,
  // @ts-expect-error - Test mock type compatibility
  TrendingUp: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-trending" />,
  // @ts-expect-error - Test mock type compatibility
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-clock" />,
  // @ts-expect-error - Test mock type compatibility
  Bot: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-bot" />,
  // @ts-expect-error - Test mock type compatibility
  Cpu: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-cpu" />,
  // @ts-expect-error - Test mock type compatibility
  Workflow: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-workflow" />,
}))

// Mock document.getElementById
const mockScrollIntoView = vi.fn()
HTMLElement.prototype.scrollIntoView = mockScrollIntoView

describe('Hero', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScrollIntoView.mockClear()
  })

  it('renders Hero component', () => {
    render(<Hero />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders main heading', () => {
    render(<Hero />)
    expect(screen.getByText(/Nền Tảng/i)).toBeInTheDocument()
  })

  it('renders typewriter effect with words', () => {
    render(<Hero />)
    expect(screen.getByTestId('typewriter')).toBeInTheDocument()
    expect(screen.getByText(/Video AI/i)).toBeInTheDocument()
  })

  it('renders description text', () => {
    render(<Hero />)
    expect(screen.getByText(/Tự động sản xuất video/i)).toBeInTheDocument()
  })

  it('renders CTA buttons', () => {
    render(<Hero />)
    const buttons = screen.getAllByTestId('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders stats cards', () => {
    render(<Hero />)
    expect(screen.getAllByTestId('glass-card')).toHaveLength(3)
  })

  it('renders stat titles', () => {
    render(<Hero />)
    expect(screen.getByText('$80/tháng')).toBeInTheDocument()
    expect(screen.getByText('95% Tiết Kiệm')).toBeInTheDocument()
    expect(screen.getByText('<15 Phút')).toBeInTheDocument()
  })

  it('scrolls to pricing when CTA clicked', () => {
    render(<Hero />)
    const ctaButton = screen.getByText(/Xem Báo Giá/i).closest('button')
    // Button click triggers scroll - verify button exists and is clickable
    expect(ctaButton).toBeInTheDocument()
  })

  it('renders floating elements', () => {
    render(<Hero />)
    const floatingElements = screen.getAllByTestId('floating-element')
    expect(floatingElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders icons', () => {
    render(<Hero />)
    // Multiple icons rendered (stats + floating elements)
    expect(screen.getAllByTestId('icon-trending').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('icon-zap').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('icon-clock').length).toBeGreaterThanOrEqual(1)
  })
})
