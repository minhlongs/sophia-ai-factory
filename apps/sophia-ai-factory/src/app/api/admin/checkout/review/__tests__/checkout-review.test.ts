import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/require-admin', async () => {
 const actual = await vi.importActual('@/seed/auth/require-admin');
 return { ...actual, requireAdmin: async () => ({ user: { id: 'admin-1' } }) };
});

import { GET, POST } from '../route';

describe('/api/admin/checkout/review', () => {
 it('GET returns queue', async () => {
   const res = await GET();
   const json = await res.json();
   expect(json).toHaveProperty('items');
   expect(Array.isArray(json.items)).toBe(true);
 });

 it('POST approve updates order status', async () => {
   const req = new NextRequest('http://localhost/api/admin/checkout/review', {
     method: 'POST',
     body: JSON.stringify({ order_id: 'order-1', action: 'approve' }),
     headers: { 'content-type': 'application/json' },
   });
   const res = await POST(req);
   const json = await res.json();
   expect(json.ok).toBe(true);
   expect(json.status).toBe('paid');
 });

 it('POST reject sets status failed with reason', async () => {
   const req = new NextRequest('http://localhost/api/admin/checkout/review', {
     method: 'POST',
     body: JSON.stringify({ order_id: 'order-2', action: 'reject', review_reason: 'mismatch' }),
     headers: { 'content-type': 'application/json' },
   });
   const res = await POST(req);
   const json = await res.json();
   expect(json.ok).toBe(true);
   expect(json.status).toBe('failed');
 });
});
