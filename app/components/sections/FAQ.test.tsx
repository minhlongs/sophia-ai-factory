import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FAQ } from './FAQ'

// Mock framer-motion and AnimatePresence
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
    },
    AnimatePresence: vi.fn(({ children }: { children: React.ReactNode }) => children),
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
  GlassCard: ({ children, className, hoverEffect }: { children: React.ReactNode; className?: string; hoverEffect?: boolean }) => (
    <div className={className} data-testid="glass-card" data-hover={hoverEffect}>
      {children}
    </div>
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
  // @ts-expect-error - Test mock type compatibility
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-chevron-down" />,
  // @ts-expect-error - Test mock type compatibility
  ChevronUp: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-chevron-up" />,
}))

describe('FAQ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders FAQ component', () => {
    render(<FAQ />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading with GradientText', () => {
    render(<FAQ />)
    expect(screen.getByText(/Câu Hỏi/i)).toBeInTheDocument()
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Thường Gặp')
  })

  it('renders all FAQ questions', () => {
    render(<FAQ />)
    expect(screen.getByText('Sophia cần biết code không?')).toBeInTheDocument()
    expect(screen.getByText('Mất bao lâu để setup hoàn chỉnh?')).toBeInTheDocument()
    expect(screen.getByText('Monthly cost bao gồm những gì?')).toBeInTheDocument()
    expect(screen.getByText('Có thể scale lên bao nhiêu video?')).toBeInTheDocument()
  })

  it('renders FAQ items with glass cards', () => {
    render(<FAQ />)
    const glassCards = screen.getAllByTestId('glass-card')
    expect(glassCards.length).toBe(4)
  })

  it('renders chevron-down icons for closed items', () => {
    render(<FAQ />)
    const chevronDowns = screen.getAllByTestId('icon-chevron-down')
    expect(chevronDowns.length).toBe(4)
  })

  it('opens FAQ item when clicked', () => {
    render(<FAQ />)
    const firstQuestion = screen.getByText('Sophia cần biết code không?')
    const button = firstQuestion.closest('button')

    expect(button).toBeInTheDocument()
    fireEvent.click(button!)

    // After click, should show chevron-up instead of chevron-down
    expect(screen.getByText(/Không. Hệ thống được thiết kế/i)).toBeInTheDocument()
  })

  it('shows answer when FAQ item is opened', () => {
    render(<FAQ />)
    const firstQuestion = screen.getByText('Sophia cần biết code không?')
    const button = firstQuestion.closest('button')
    fireEvent.click(button!)

    expect(screen.getByText(/Không. Hệ thống được thiết kế để bạn chỉ cần gửi command/i)).toBeInTheDocument()
  })

  it('renders FadeIn animations for FAQ items', () => {
    render(<FAQ />)
    const fadeIns = screen.getAllByTestId('fade-in')
    expect(fadeIns.length).toBeGreaterThanOrEqual(4)
  })

  it('renders FAQ answers initially hidden', () => {
    render(<FAQ />)
    // Answers should not be visible initially
    expect(screen.queryByText(/Không. Hệ thống được thiết kế/i)).not.toBeInTheDocument()
  })

  it('toggles FAQ item open and closed', () => {
    render(<FAQ />)
    const firstQuestion = screen.getByText('Sophia cần biết code không?')
    const button = firstQuestion.closest('button')

    // Open
    fireEvent.click(button!)
    expect(screen.getByText(/Không. Hệ thống được thiết kế/i)).toBeInTheDocument()

    // Close
    fireEvent.click(button!)
    expect(screen.queryByText(/Không. Hệ thống được thiết kế/i)).not.toBeInTheDocument()
  })
})
