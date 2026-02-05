import { describe, it, expect, vi, beforeEach } from 'vitest';
import { polar } from '@/lib/polar';
import { NextResponse } from 'next/server';

// Mock Dependencies
vi.mock('@/lib/polar', () => ({
  polar: {
    checkouts: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}));

import { createClient } from '@/lib/supabase/server';

describe('Checkout API Route', () => {
  const mockAuthGetUser = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock Supabase Auth
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: mockAuthGetUser,
      },
    });

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } } });

    // Reset Env Vars
    delete process.env.POLAR_PRODUCT_BASIC_ID;
    delete process.env.POLAR_PRODUCT_PREMIUM_ID;
    delete process.env.POLAR_PRODUCT_ENTERPRISE_ID;
  });

  it('should return 400 if missing productId and valid tier', async () => {
    const { POST } = await import('./route');
    const req = {
      json: vi.fn().mockResolvedValue({}),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const response = await POST(req);
    expect(response).toEqual(expect.objectContaining({ status: 400 }));
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Missing productId or valid tier' },
      { status: 400 }
    );
  });

  it('should create checkout session with productId', async () => {
    const { POST } = await import('./route');
    const req = {
      json: vi.fn().mockResolvedValue({ productId: 'prod_123' }),
      headers: new Map(),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polar.checkouts.create as any).mockResolvedValue({ url: 'https://checkout.url' });

    const response = await POST(req);

    expect(polar.checkouts.create).toHaveBeenCalledWith(expect.objectContaining({
      products: ['prod_123'],
      customerEmail: 'test@example.com',
    }));
    expect(response).toEqual(expect.objectContaining({ body: { url: 'https://checkout.url' } }));
  });

  it('should create checkout session with valid tier mapping', async () => {
    // Setup env vars for test BEFORE importing route
    process.env.NEXT_PUBLIC_POLAR_PRODUCT_STARTER_ID = 'basic_123';

    const { POST } = await import('./route');

    const req = {
      json: vi.fn().mockResolvedValue({ tier: 'BASIC' }),
      headers: new Map(),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polar.checkouts.create as any).mockResolvedValue({ url: 'https://checkout.url' });

    await POST(req);

    expect(polar.checkouts.create).toHaveBeenCalledWith(expect.objectContaining({
      products: ['basic_123'],
      metadata: expect.objectContaining({ tier: 'BASIC' })
    }));
  });

  it('should handle anonymous users (no email)', async () => {
    const { POST } = await import('./route');
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const req = {
      json: vi.fn().mockResolvedValue({ productId: 'prod_123' }),
      headers: new Map(),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polar.checkouts.create as any).mockResolvedValue({ url: 'https://checkout.url' });

    await POST(req);

    expect(polar.checkouts.create).toHaveBeenCalledWith(expect.not.objectContaining({
      customerEmail: expect.any(String),
    }));
  });

  it('should return 500 on polar error', async () => {
    const { POST } = await import('./route');
    const req = {
      json: vi.fn().mockResolvedValue({ productId: 'prod_123' }),
      headers: new Map(),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (polar.checkouts.create as any).mockRejectedValue(new Error('Polar error'));

    const response = await POST(req);
    expect(response).toEqual(expect.objectContaining({ status: 500 }));
  });
});
