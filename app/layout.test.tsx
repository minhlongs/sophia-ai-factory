import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RootLayout from './layout'

// Mock LazyMotionProvider
vi.mock('./components/providers/LazyMotionProvider', () => ({
  LazyMotionProvider: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="lazy-motion-provider">{children}</div>
  )),
}))

// Mock Google fonts
vi.mock('next/font/google', () => ({
  Geist: vi.fn(() => ({
    variable: '--font-inter',
    className: 'font-inter',
  })),
  Geist_Mono: vi.fn(() => ({
    variable: '--font-space',
    className: 'font-space',
  })),
}))

describe('RootLayout', () => {
  it('renders RootLayout', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    )
    expect(screen.getByTestId('lazy-motion-provider')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <RootLayout>
        <div data-testid="child-content">Test Content</div>
      </RootLayout>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })
})
