// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { payOsCanonicalize } from '@/land/payments/payos-gateway';
import { validatePayOsRequest } from './request-validator';

function delivery(rootSuccess: boolean, code?: string, currency: string = 'VND') {
  const data = { orderCode: 123, amount: 1990000, description: 'pilot', paymentLinkId: 'link', code, currency };
  const signature = createHmac('sha256', 'fixture-key').update(payOsCanonicalize(JSON.stringify({ data }))).digest('hex');
  return new Request('http://localhost/api/payos/ipn', { method: 'POST', body: JSON.stringify({ code: '00', desc: 'success', success: rootSuccess, data, signature }) });
}
describe('legacy PayOS signed payment authority', () => {
  it('accepts signed success even if unsigned root success is false', async () => {
    expect(await validatePayOsRequest(delivery(false, '00'), 'fixture-key')).toMatchObject({ ok: true, data: { success: true } });
  });
  it('uses signed failure even if unsigned root success is true', async () => {
    expect(await validatePayOsRequest(delivery(true, '01'), 'fixture-key')).toMatchObject({ ok: true, data: { success: false } });
  });
  it('does not grant payment success without a signed result code', async () => {
    expect(await validatePayOsRequest(delivery(true), 'fixture-key')).toMatchObject({ ok: false, status: 400 });
  });
  it('rejects a signed non-VND currency', async () => {
    expect(await validatePayOsRequest(delivery(true, '00', 'USD'), 'fixture-key')).toMatchObject({ ok: false, status: 400 });
  });
});
