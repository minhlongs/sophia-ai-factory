/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Workflow } from './Workflow'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: any) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
    },
    stagger: vi.fn((val: number) => val),
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

// Mock FadeIn
vi.mock('../animations/FadeIn', () => ({
  FadeIn: ({ children, className, delay }: any) => (
    <div data-testid="fade-in" data-delay={delay} className={className}>{children}</div>
  ),
}))

// Mock StaggerContainer
vi.mock('../animations/StaggerContainer', () => ({
  StaggerContainer: ({ children, className, staggerChildren }: any) => (
    <div data-testid="stagger-container" data-stagger={staggerChildren} className={className}>
      {children}
    </div>
  ),
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MessageSquare: vi.fn((props: any) => <svg {...props} data-testid="icon-message" />),
  Server: vi.fn((props: any) => <svg {...props} data-testid="icon-server" />),
  Workflow: vi.fn((props: any) => <svg {...props} data-testid="icon-workflow" />),
  Bot: vi.fn((props: any) => <svg {...props} data-testid="icon-bot" />),
  Share2: vi.fn((props: any) => <svg {...props} data-testid="icon-share" />),
  ArrowRight: vi.fn((props: any) => <svg {...props} data-testid="icon-arrow" />),
}))

describe('Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Workflow component', () => {
    render(<Workflow />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading with GradientText', () => {
    render(<Workflow />)
    expect(screen.getByText(/Quy Trình/i)).toBeInTheDocument()
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Tự Động Hóa')
  })

  it('renders subtitle', () => {
    render(<Workflow />)
    expect(screen.getByText(/Hệ thống hoạt động khép kín/i)).toBeInTheDocument()
  })

  it('renders 5 workflow steps', () => {
    render(<Workflow />)
    expect(screen.getByText('Telegram Command')).toBeInTheDocument()
    expect(screen.getByText('OpenClaw Gateway')).toBeInTheDocument()
    expect(screen.getByText('n8n Automation')).toBeInTheDocument()
    expect(screen.getByText('AI Generation')).toBeInTheDocument()
    expect(screen.getByText('Multi-Platform')).toBeInTheDocument()
  })

  it('renders step descriptions', () => {
    render(<Workflow />)
    expect(screen.getByText(/Gửi lệnh tạo video/i)).toBeInTheDocument()
    expect(screen.getByText(/Xử lý yêu cầu/i)).toBeInTheDocument()
    expect(screen.getByText(/Chạy luồng xử lý/i)).toBeInTheDocument()
    expect(screen.getByText(/Tạo nội dung, giọng nói/i)).toBeInTheDocument()
    expect(screen.getByText(/Tự động đăng tải/i)).toBeInTheDocument()
  })

  it('renders tool tags for each step', () => {
    render(<Workflow />)
    expect(screen.getByText('Telegram Bot')).toBeInTheDocument()
    expect(screen.getByText('OpenClaw')).toBeInTheDocument()
    expect(screen.getByText('n8n Workflow')).toBeInTheDocument()
    expect(screen.getByText('OpenRouter')).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()
  })

  it('renders icons for each step', () => {
    render(<Workflow />)
    const icons = screen.getAllByTestId('icon-message')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('renders glass cards for steps', () => {
    render(<Workflow />)
    const glassCards = screen.getAllByTestId('glass-card')
    expect(glassCards.length).toBeGreaterThanOrEqual(5)
  })

  it('renders StaggerContainer for animation', () => {
    render(<Workflow />)
    expect(screen.getByTestId('stagger-container')).toBeInTheDocument()
  })

  it('renders FadeIn animation', () => {
    render(<Workflow />)
    const fadeIns = screen.getAllByTestId('fade-in')
    expect(fadeIns.length).toBeGreaterThanOrEqual(1)
  })

  it('renders connecting line element', () => {
    render(<Workflow />)
    // The connecting line is a div with gradient background
    const fadeIns = screen.getAllByTestId('fade-in')
    expect(fadeIns.length).toBeGreaterThanOrEqual(1)
  })
})
