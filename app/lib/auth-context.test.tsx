/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './auth-context'
import { LicenseService } from './license-service'

// Mock LicenseService
vi.mock('./license-service', () => ({
  LicenseService: {
    getAll: vi.fn(() => []),
    getById: vi.fn(() => null),
  },
}))

// Test wrapper component
function TestComponent() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="is-authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="is-loading">{String(auth.isLoading)}</span>
      <span data-testid="error">{auth.error || 'none'}</span>
      <button onClick={() => auth.validateLicense('test-key')}>Validate</button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  )
}

describe('auth-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders AuthProvider', () => {
    render(
      <AuthProvider>
        <div>Test</div>
      </AuthProvider>
    )
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('initializes with no authentication', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
  })

  it('authenticates with active license', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([
      {
        id: 'lic_1',
        customerId: 'cust_1',
        tier: 'PRO',
        status: 'active',
        subscriptionStatus: 'active',
        features: [],
        metadata: { licenseKey: 'test-key' },
      } as any,
    ])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
  })

  it('validates license successfully', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([
      {
        id: 'lic_1',
        customerId: 'cust_1',
        tier: 'PRO',
        status: 'active',
        subscriptionStatus: 'active',
        features: [],
        metadata: { licenseKey: 'test-key' },
      } as any,
    ])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const validateBtn = screen.getByText('Validate')
    fireEvent.click(validateBtn)

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('rejects invalid license key', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const validateBtn = screen.getByText('Validate')
    fireEvent.click(validateBtn)

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Invalid license key')
  })

  it('rejects inactive license', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([
      {
        id: 'lic_1',
        customerId: 'cust_1',
        tier: 'PRO',
        status: 'revoked',
        subscriptionStatus: undefined,
        features: [],
        metadata: { licenseKey: 'test-key' },
      } as any,
    ])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const validateBtn = screen.getByText('Validate')
    fireEvent.click(validateBtn)

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('License is revoked')
  })

  it('logs out successfully', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([
      {
        id: 'lic_1',
        customerId: 'cust_1',
        tier: 'PRO',
        status: 'active',
        subscriptionStatus: 'active',
        features: [],
        metadata: { licenseKey: 'test-key' },
      } as any,
    ])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    })

    const logoutBtn = screen.getByText('Logout')
    fireEvent.click(logoutBtn)

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('handles validation error', async () => {
    vi.mocked(LicenseService.getAll).mockImplementation(() => {
      throw new Error('Service unavailable')
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const validateBtn = screen.getByText('Validate')
    fireEvent.click(validateBtn)

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Service unavailable')
  })

  it('throws error when useAuth used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('loads license on mount', async () => {
    vi.mocked(LicenseService.getAll).mockReturnValue([
      {
        id: 'lic_1',
        customerId: 'cust_1',
        tier: 'ENTERPRISE',
        status: 'active',
        subscriptionStatus: 'active',
        features: ['feature1'],
      } as any,
    ])

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    })
  })

  it('handles license load failure', async () => {
    vi.mocked(LicenseService.getAll).mockImplementation(() => {
      throw new Error('Failed to load')
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to load license')
  })
})
