import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { verifyWebhookSignature } from '@/lib/polar';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

import { headers } from 'next/headers';

// Mock lib/polar
vi.mock('@/lib/polar', () => ({
  verifyWebhookSignature: vi.fn(),
  polar: {
    // Mock other polar exports if needed
  }
}));

// Mock inngest
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['job_123'] }),
  },
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'camp_123' }, error: null }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { tier: 'free' }, error: null }))
        }))
      }))
    })),
    auth: {
      admin: {
        listUsers: vi.fn(() => Promise.resolve({
          data: {
            users: [{ id: 'user_123', email: 'test@example.com' }]
          },
          error: null
        }))
      }
    }
  }))
}));

// Mock console to keep test output clean
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('Polar Webhook API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    console.error = vi.fn();
    console.log = vi.fn();

    // Set environment variables
    process.env.POLAR_WEBHOOK_SECRET = 'test_secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_key';
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    delete process.env.POLAR_WEBHOOK_SECRET;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('returns 500 if POLAR_WEBHOOK_SECRET is missing', async () => {
    delete process.env.POLAR_WEBHOOK_SECRET;

    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers({
      'webhook-signature': 'signature'
    }));

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: 'payload',
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Server Configuration Error');
  });

  it('returns 400 if webhook-signature is missing', async () => {
    // Mock headers without signature
    vi.mocked(headers).mockResolvedValue(new Headers({}));

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: 'payload',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Missing webhook-signature header');
  });

  it('returns 400 if signature verification fails', async () => {
    vi.mocked(verifyWebhookSignature).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers({
      'webhook-signature': 'invalid_signature'
    }));

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: 'payload',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Invalid signature');
  });

  it('processes checkout.session.completed event successfully', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        id: 'checkout_123',
        customerEmail: 'test@example.com',
        email: 'test@example.com'
      }
    };

    vi.mocked(verifyWebhookSignature).mockReturnValue(mockEvent);

    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers({
      'webhook-signature': 'valid_signature'
    }));

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
    });

    const res = await POST(req);

    // Debugging: If status is not 200, print the console.error calls
    if (res.status !== 200) {
      console.log('Test failed with status', res.status);
      console.log('Console errors:', vi.mocked(console.error).mock.calls);
    }

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Webhook received');
    expect(console.log).toHaveBeenCalledWith('✅ Processing checkout.session.completed for test@example.com');
  });

  it('processes order.created event successfully', async () => {
    const mockEvent = {
      type: 'order.created',
      data: {
        id: 'order_123',
        email: 'test@example.com'
      }
    };

    vi.mocked(verifyWebhookSignature).mockReturnValue(mockEvent);

    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers({
      'webhook-signature': 'valid_signature'
    }));

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(console.log).toHaveBeenCalledWith('✅ Processing order.created for test@example.com');
  });

  it('handles processing errors gracefully', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        id: '123',
        email: 'error@example.com'
      }
    };

    vi.mocked(verifyWebhookSignature).mockReturnValue(mockEvent);

    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers({
      'webhook-signature': 'valid_signature'
    }));

    // Force an error inside the switch or subsequent logic
    // We can spy on console.log and make it throw
    vi.spyOn(console, 'log').mockImplementationOnce(() => {
        throw new Error('Processing failed');
    });

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Error processing webhook');
    expect(console.error).toHaveBeenCalledWith('Error processing webhook:', expect.any(Error));
  });

  it('handles unknown event types gracefully', async () => {
    const mockEvent = {
      type: 'unknown.event',
      data: {
        id: '123',
        email: 'unknown@example.com'
      }
    };

    vi.mocked(verifyWebhookSignature).mockReturnValue(mockEvent);

    // Mock headers
    vi.mocked(headers).mockResolvedValue(new Headers({
      'webhook-signature': 'valid_signature'
    }));

    const req = new Request('http://localhost/api/webhooks/polar', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
    });

    const res = await POST(req);
    expect(res.status).toBe(200); // Should still return 200 to acknowledge receipt
    expect(console.log).toHaveBeenCalledWith('ℹ️ Unhandled event type: unknown.event');
  });
});
