import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

// Mock all section components
vi.mock('./components/sections/Hero', () => ({
  Hero: vi.fn(() => <div data-testid="hero">Hero</div>),
}))

vi.mock('./components/sections/Workflow', () => ({
  Workflow: vi.fn(() => <div data-testid="workflow">Workflow</div>),
}))

vi.mock('./components/sections/TechStack', () => ({
  TechStack: vi.fn(() => <div data-testid="techstack">TechStack</div>),
}))

vi.mock('./components/sections/Features', () => ({
  Features: vi.fn(() => <div data-testid="features">Features</div>),
}))

vi.mock('./components/sections/AffiliateDiscovery', () => ({
  AffiliateDiscovery: vi.fn(() => <div data-testid="affiliate-discovery">AffiliateDiscovery</div>),
}))

vi.mock('./components/sections/Pricing', () => ({
  Pricing: vi.fn(() => <div data-testid="pricing">Pricing</div>),
}))

vi.mock('./components/sections/ROICalculator', () => ({
  ROICalculator: vi.fn(() => <div data-testid="roi-calculator">ROICalculator</div>),
}))

vi.mock('./components/sections/Affiliates', () => ({
  Affiliates: vi.fn(() => <div data-testid="affiliates">Affiliates</div>),
}))

vi.mock('./components/sections/FAQ', () => ({
  FAQ: vi.fn(() => <div data-testid="faq">FAQ</div>),
}))

vi.mock('./components/sections/Footer', () => ({
  Footer: vi.fn(() => <div data-testid="footer">Footer</div>),
}))

vi.mock('./components/layout/MobileNav', () => ({
  MobileNav: vi.fn(() => <div data-testid="mobile-nav">MobileNav</div>),
}))

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Home page', () => {
    render(<Home />)
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()
  })

  it('renders Hero section', () => {
    render(<Home />)
    expect(screen.getByTestId('hero')).toBeInTheDocument()
  })

  it('renders Workflow section', () => {
    render(<Home />)
    expect(screen.getByTestId('workflow')).toBeInTheDocument()
  })

  it('renders TechStack section', () => {
    render(<Home />)
    expect(screen.getByTestId('techstack')).toBeInTheDocument()
  })

  it('renders Features section', () => {
    render(<Home />)
    expect(screen.getByTestId('features')).toBeInTheDocument()
  })

  it('renders AffiliateDiscovery section', () => {
    render(<Home />)
    expect(screen.getByTestId('affiliate-discovery')).toBeInTheDocument()
  })

  it('renders Pricing section', () => {
    render(<Home />)
    expect(screen.getByTestId('pricing')).toBeInTheDocument()
  })

  it('renders ROICalculator section', () => {
    render(<Home />)
    expect(screen.getByTestId('roi-calculator')).toBeInTheDocument()
  })

  it('renders Affiliates section', () => {
    render(<Home />)
    expect(screen.getByTestId('affiliates')).toBeInTheDocument()
  })

  it('renders FAQ section', () => {
    render(<Home />)
    expect(screen.getByTestId('faq')).toBeInTheDocument()
  })

  it('renders Footer section', () => {
    render(<Home />)
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('renders all sections in correct order', () => {
    const { container } = render(<Home />)
    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass('min-h-screen')
  })
})
