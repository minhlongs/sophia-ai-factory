import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Footer } from './Footer'

// Mock Container
vi.mock('../ui/Container', () => ({
  Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="container">{children}</div>
  ),
}))

// Mock Button
vi.mock('../ui/Button', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button data-testid="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  // @ts-expect-error - Test mock type compatibility
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-mail" />,
  // @ts-expect-error - Test mock type compatibility
  Phone: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-phone" />,
  // @ts-expect-error - Test mock type compatibility
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-calendar" />,
}))

// Mock window.open
const mockWindowOpen = vi.fn()
Object.defineProperty(global, 'open', {
  value: mockWindowOpen,
  writable: true,
})

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWindowOpen.mockClear()
  })

  it('renders Footer component', () => {
    render(<Footer />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders AgencyOS branding', () => {
    render(<Footer />)
    expect(screen.getByText('AgencyOS')).toBeInTheDocument()
    expect(screen.getByText('Empowering creators with AI Automation')).toBeInTheDocument()
  })

  it('renders email link', () => {
    render(<Footer />)
    expect(screen.getByText('contact@agencyos.ai')).toBeInTheDocument()
    expect(screen.getByTestId('icon-mail')).toBeInTheDocument()
  })

  it('renders phone link', () => {
    render(<Footer />)
    expect(screen.getByText('098.xxx.xxxx (Zalo)').closest('a')).toHaveAttribute('href', '#')
    expect(screen.getByTestId('icon-phone')).toBeInTheDocument()
  })

  it('renders Book a Call button', () => {
    render(<Footer />)
    expect(screen.getByTestId('button')).toHaveTextContent('Book a Call')
    expect(screen.getByTestId('icon-calendar')).toBeInTheDocument()
  })

  it('opens Calendly link when button clicked', () => {
    render(<Footer />)
    const button = screen.getByTestId('button')
    fireEvent.click(button)
    expect(mockWindowOpen).toHaveBeenCalledWith('https://calendly.com', '_blank')
  })

  it('renders copyright notice', () => {
    render(<Footer />)
    const currentYear = new Date().getFullYear()
    expect(screen.getByText(`© ${currentYear} AgencyOS. All rights reserved.`)).toBeInTheDocument()
  })

  it('renders footer with correct structure', () => {
    render(<Footer />)
    // Check footer element exists
    const footer = screen.getByTestId('container').parentElement
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass('border-t')
  })
})
