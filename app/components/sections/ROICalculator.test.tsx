import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ROICalculator } from './ROICalculator'

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
  FadeIn: ({ children, className, delay, direction }: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: string;
  }) => (
    <div data-testid="fade-in" data-delay={delay} data-direction={direction} className={className}>
      {children}
    </div>
  ),
}))

// Mock formatNumber
vi.mock('@/app/lib/utils', () => ({
  formatNumber: (value: number) => value.toLocaleString(),
}))

describe('ROICalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ROICalculator component', () => {
    render(<ROICalculator />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading with GradientText', () => {
    render(<ROICalculator />)
    expect(screen.getByText(/Tính Toán/i)).toBeInTheDocument()
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Lợi Nhuận (ROI)')
  })

  it('renders subtitle', () => {
    render(<ROICalculator />)
    expect(screen.getByText(/Ước tính tiềm năng thu nhập/i)).toBeInTheDocument()
  })

  it('renders input section title', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Thông số đầu vào')).toBeInTheDocument()
  })

  it('renders result section title', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Dự báo doanh thu')).toBeInTheDocument()
  })

  it('renders Videos/tháng slider', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Videos xuất bản / tháng')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders View/video slider', () => {
    render(<ROICalculator />)
    expect(screen.getByText('View trung bình / video')).toBeInTheDocument()
    expect(screen.getByText('2,000')).toBeInTheDocument()
  })

  it('renders CTR slider', () => {
    render(<ROICalculator />)
    expect(screen.getByText('CTR (Click-through Rate)')).toBeInTheDocument()
    expect(screen.getByText('2%')).toBeInTheDocument()
  })

  it('renders Conversion Rate slider', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument()
    expect(screen.getByText('1%')).toBeInTheDocument()
  })

  it('renders Hoa hồng/slider', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Hoa hồng trung bình / Sale')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
  })

  it('renders monthly revenue display', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Doanh thu tháng')).toBeInTheDocument()
  })

  it('renders annual revenue display', () => {
    render(<ROICalculator />)
    expect(screen.getByText('Doanh thu năm')).toBeInTheDocument()
  })

  it('renders ROI display', () => {
    render(<ROICalculator />)
    expect(screen.getByText('ROI (Năm đầu)')).toBeInTheDocument()
  })

  it('renders two glass cards for inputs and results', () => {
    render(<ROICalculator />)
    const glassCards = screen.getAllByTestId('glass-card')
    expect(glassCards.length).toBeGreaterThanOrEqual(2)
  })

  it('renders fade-in animations', () => {
    render(<ROICalculator />)
    const fadeIns = screen.getAllByTestId('fade-in')
    expect(fadeIns.length).toBeGreaterThanOrEqual(2)
  })
})
