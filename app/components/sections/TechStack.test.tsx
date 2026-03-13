/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TechStack } from './TechStack'

// Mock framer-motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      h2: actual.motion?.h2 ?? vi.fn(({ children, ...props }: any) => (
        <h2 data-testid="motion-h2" {...props}>{children}</h2>
      )),
      p: actual.motion?.p ?? vi.fn(({ children, ...props }: any) => (
        <p data-testid="motion-p" {...props}>{children}</p>
      )),
      div: actual.motion?.div ?? vi.fn(({ children, ...props }: any) => (
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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bot: vi.fn((props: any) => <svg {...props} data-testid="icon-bot" />),
  Cpu: vi.fn((props: any) => <svg {...props} data-testid="icon-cpu" />),
  Database: vi.fn((props: any) => <svg {...props} data-testid="icon-database" />),
  Cloud: vi.fn((props: any) => <svg {...props} data-testid="icon-cloud" />),
  Mic: vi.fn((props: any) => <svg {...props} data-testid="icon-mic" />),
  Video: vi.fn((props: any) => <svg {...props} data-testid="icon-video" />),
  Zap: vi.fn((props: any) => <svg {...props} data-testid="icon-zap" />),
  Layers: vi.fn((props: any) => <svg {...props} data-testid="icon-layers" />),
}))

describe('TechStack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders TechStack component', () => {
    render(<TechStack />)
    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  it('renders heading with GradientText', () => {
    render(<TechStack />)
    expect(screen.getByText(/Tech Stack/i)).toBeInTheDocument()
    expect(screen.getByTestId('gradient-text')).toHaveTextContent('Mạnh Mẽ')
  })

  it('renders subtitle', () => {
    render(<TechStack />)
    expect(screen.getByText(/Tích hợp những công nghệ AI hàng đầu/i)).toBeInTheDocument()
  })

  it('renders OpenClaw tool', () => {
    render(<TechStack />)
    expect(screen.getByText('OpenClaw')).toBeInTheDocument()
    expect(screen.getByText('Orchestrator')).toBeInTheDocument()
  })

  it('renders n8n tool', () => {
    render(<TechStack />)
    expect(screen.getByText('n8n')).toBeInTheDocument()
    expect(screen.getByText('Automation')).toBeInTheDocument()
  })

  it('renders OpenRouter tool', () => {
    render(<TechStack />)
    expect(screen.getByText('OpenRouter')).toBeInTheDocument()
    expect(screen.getByText('300+ AI Models')).toBeInTheDocument()
  })

  it('renders ElevenLabs tool', () => {
    render(<TechStack />)
    expect(screen.getByText('ElevenLabs')).toBeInTheDocument()
    expect(screen.getByText('Voice Cloning')).toBeInTheDocument()
  })

  it('renders D-ID tool', () => {
    render(<TechStack />)
    expect(screen.getByText('D-ID')).toBeInTheDocument()
    expect(screen.getByText('AI Avatar')).toBeInTheDocument()
  })

  it('renders Pictory tool', () => {
    render(<TechStack />)
    expect(screen.getByText('Pictory')).toBeInTheDocument()
    expect(screen.getByText('B-Roll Gen')).toBeInTheDocument()
  })

  it('renders Airtable tool', () => {
    render(<TechStack />)
    expect(screen.getByText('Airtable')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })

  it('renders Cloudinary tool', () => {
    render(<TechStack />)
    expect(screen.getByText('Cloudinary')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
  })

  it('renders 8 tech cards', () => {
    render(<TechStack />)
    const glassCards = screen.getAllByTestId('glass-card')
    expect(glassCards).toHaveLength(8)
  })

  it('renders motion elements for heading', () => {
    render(<TechStack />)
    // h2 is rendered with motion.h2 but useInView returns true so it shows
    const heading = screen.getByText(/Tech Stack/i)
    expect(heading).toBeInTheDocument()
  })

  it('renders motion elements for subtitle', () => {
    render(<TechStack />)
    const subtitle = screen.getByText(/Tích hợp những công nghệ AI/i)
    expect(subtitle).toBeInTheDocument()
  })
})
