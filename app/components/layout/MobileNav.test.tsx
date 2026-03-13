import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNav } from './MobileNav'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid="motion-div" {...props}>{children}</div>
      )),
      a: actual.motion?.a ?? vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <a data-testid="motion-a" {...props}>{children}</a>
      )),
    },
    AnimatePresence: vi.fn(({ children }: { children: React.ReactNode }) => children),
  }
})

// Mock Button
vi.mock('../ui/Button', () => ({
  Button: ({ children, onClick, className, size }: { children: React.ReactNode; onClick?: () => void; className?: string; size?: string }) => (
    <button data-testid="button" data-size={size} onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-menu" />),
  X: vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-x" />),
  ArrowRight: vi.fn((props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="icon-arrow" />),
}))

// Mock scrollIntoView
const mockScrollIntoView = vi.fn()
HTMLElement.prototype.scrollIntoView = mockScrollIntoView

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScrollIntoView.mockClear()
  })

  it('renders MobileNav component', () => {
    render(<MobileNav />)
    expect(screen.getByTestId('icon-menu')).toBeInTheDocument()
  })

  it('renders menu button', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    expect(menuButton).toBeInTheDocument()
  })

  it('opens menu when button clicked', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    // Menu should open with navigation links
    expect(screen.getByText('Tính Năng')).toBeInTheDocument()
    expect(screen.getByText('Quy Trình')).toBeInTheDocument()
    expect(screen.getByText('Bảng Giá')).toBeInTheDocument()
    expect(screen.getByText('FAQ')).toBeInTheDocument()
  })

  it('renders navigation links when open', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    const links = screen.getAllByText(/Tính Năng|Quy Trình|Bảng Giá|FAQ/)
    expect(links.length).toBeGreaterThanOrEqual(4)
  })

  it('renders CTA button when menu open', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    expect(screen.getByTestId('button')).toHaveTextContent('Liên Hệ Ngay')
  })

  it('closes menu when nav link clicked', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    const firstLink = screen.getByText('Tính Năng')
    fireEvent.click(firstLink)

    // Menu closes, showing menu icon again
    expect(screen.getByTestId('icon-menu')).toBeInTheDocument()
  })

  it('closes menu and scrolls to footer when CTA clicked', () => {
    // Add footer element to DOM for scrollIntoView to work
    const footer = document.createElement('footer')
    footer.id = 'footer'
    document.body.appendChild(footer)

    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    const ctaButton = screen.getByTestId('button')
    fireEvent.click(ctaButton)

    // CTA button triggers scroll to footer
    expect(mockScrollIntoView).toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(footer)
  })

  it('toggles menu open and closed', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })

    // Open
    fireEvent.click(menuButton)
    expect(screen.getByText('Tính Năng')).toBeInTheDocument()

    // Close
    fireEvent.click(menuButton)
    expect(screen.queryByText('Tính Năng')).not.toBeInTheDocument()
  })

  it('renders menu icon when closed', () => {
    render(<MobileNav />)
    expect(screen.getByTestId('icon-menu')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-x')).not.toBeInTheDocument()
  })

  it('renders X icon when open', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(menuButton)

    expect(screen.getByTestId('icon-x')).toBeInTheDocument()
  })

  it('applies correct styling to menu button', () => {
    render(<MobileNav />)
    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    expect(menuButton).toHaveClass('fixed', 'top-6', 'right-6')
  })
})
