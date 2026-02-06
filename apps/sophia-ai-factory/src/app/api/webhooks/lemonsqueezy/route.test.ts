import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import crypto from 'crypto';

// 1. Create hoisted mocks
const mocks = vi.hoisted(() => {
  const getUserById = vi.fn();
  const listUsers = vi.fn();

  // Create chainable methods
  const select = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const eq = vi.fn();
  const single = vi.fn();

  // Create a builder object that references these methods
  // We include a "then" property to simulate a Promise-like object (PostgrestBuilder)
  // This allows `await supabase.from(...).insert(...)` to work even without `.select().single()`
  const builder = {
    select,
    insert,
    update,
    upsert,
    eq,
    single,
    then: (resolve: any) => Promise.resolve({ data: {}, error: null }).then(resolve)
  };

  // Wire up the chaining - return the builder for all chainable methods
  select.mockReturnValue(builder);
  insert.mockReturnValue(builder);
  update.mockReturnValue(builder);
  upsert.mockReturnValue(builder);
  eq.mockReturnValue(builder);
  single.mockResolvedValue({ data: {}, error: null });

  const from = vi.fn().mockReturnValue(builder);

  const createClient = vi.fn().mockReturnValue({
    auth: {
      admin: {
        getUserById,
        listUsers
      }
    },
    from
  });

  return {
    createClient,
    from,
    builder,
    select,
    insert,
    update,
    upsert,
    eq,
    single,
    getUserById
  };
});

// 2. Mock dependencies using hoisted variables
vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn()
  }
}));

vi.mock('next/headers', () => ({
  headers: vi.fn()
}));

// Import mocks after definition
import { headers } from 'next/headers';
import { inngest } from '@/lib/inngest/client';

describe('Lemon Squeezy Webhook', () => {
  const mockSecret = 'test-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = mockSecret;

    // Reset default mock implementations
    mocks.upsert.mockReturnValue(mocks.builder);
    mocks.update.mockReturnValue(mocks.builder);
    mocks.insert.mockReturnValue(mocks.builder);
    mocks.select.mockReturnValue(mocks.builder);
    mocks.eq.mockReturnValue(mocks.builder);
    mocks.single.mockResolvedValue({ data: {}, error: null });

    // Ensure from returns the builder
    mocks.from.mockReturnValue(mocks.builder);
  });

  const createRequest = (body: any, signature?: string) => {
    const bodyString = JSON.stringify(body);
    const computedSignature = crypto
      .createHmac('sha256', mockSecret)
      .update(bodyString)
      .digest('hex');

    // Use provided signature or computed one
    const finalSignature = signature !== undefined ? signature : computedSignature;

    // Mock headers
    (headers as any).mockResolvedValue({
      get: (key: string) => {
        if (key === 'x-signature') return finalSignature;
        return null;
      }
    });

    return new Request('http://localhost:3000/api/webhooks/lemonsqueezy', {
      method: 'POST',
      body: bodyString
    });
  };

  it('should return 500 if secret is missing', async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('should return 400 if signature is missing', async () => {
    (headers as any).mockResolvedValue({
      get: () => null
    });
    const req = new Request('http://localhost', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 if signature is invalid', async () => {
    // Generate a random hex string of 64 characters (matching SHA256 length)
    // crypto.randomBytes(32) -> 32 bytes -> 64 hex chars
    const invalidSignature = crypto.randomBytes(32).toString('hex');
    const req = createRequest({}, invalidSignature);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should handle order_created event', async () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const payload = {
      meta: {
        event_name: 'order_created',
        custom_data: { userId }
      },
      data: {
        id: 'order-1',
        attributes: {
          customer_id: 'cust-1',
          identifier: 'ord-1',
          user_email: email,
          first_order_item: {
            product_name: 'Sophia AI Growth'
          }
        }
      }
    };

    // Mock getUserById
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: userId, email } },
      error: null
    });

    // Mock response for campaign creation check
    // If the code uses insert().select().single()
    mocks.single.mockResolvedValue({
         data: { id: 'camp-1', topic: 'Welcome' },
         error: null
    });

    const req = createRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Verify user profile update
    expect(mocks.from).toHaveBeenCalledWith('user_profiles');
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      subscription_tier: 'premium', // Growth maps to PREMIUM -> 'premium' in DB
      lemonsqueezy_customer_id: 'cust-1'
    }));

    // Verify welcome campaign trigger
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
        name: 'campaign.created'
    }));
  });

  it('should handle subscription_created event', async () => {
    const userId = 'user-123';
    const payload = {
      meta: {
        event_name: 'subscription_created',
        custom_data: { userId }
      },
      data: {
        id: 'sub-1',
        attributes: {
          status: 'active',
          customer_id: 'cust-1',
          order_id: 'ord-1',
          product_name: 'Sophia AI Factory - Premium',
          user_email: 'test@example.com',
          renews_at: '2026-03-01T00:00:00Z',
          ends_at: null
        }
      }
    };

    mocks.getUserById.mockResolvedValue({
      data: { user: { id: userId } },
      error: null
    });

    const req = createRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith('user_profiles');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      subscription_status: 'active',
      lemonsqueezy_subscription_id: 'sub-1',
      subscription_tier: 'enterprise' // Premium maps to ENTERPRISE -> 'enterprise' in DB
    }));
  });

  it('should handle subscription_cancelled event', async () => {
    const payload = {
      meta: {
        event_name: 'subscription_cancelled',
        custom_data: {}
      },
      data: {
        id: 'sub-1',
        attributes: {
          status: 'cancelled',
          customer_id: 'cust-1',
          user_email: 'test@example.com'
        }
      }
    };

    const req = createRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith('user_profiles');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      subscription_status: 'cancelled'
    }));
    expect(mocks.eq).toHaveBeenCalledWith('lemonsqueezy_subscription_id', 'sub-1');
  });
});
