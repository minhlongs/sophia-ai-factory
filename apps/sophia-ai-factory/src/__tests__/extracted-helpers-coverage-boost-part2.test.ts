/**
 * Targeted branch coverage suite part 2 (< 180 LOC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFirstRunTemplateText,
  TemplateCardGrid,
} from '@/components/missions/first-run/template-configurator-cards';
import {
  toBase64Url,
  fromBase64Url,
  hmacSign,
  hmacVerify,
  getSecret,
} from '@/seed/auth/reset-password-crypto';
import { computeHmacSha256Hex } from '@/seed/security/hmac-webcrypto-digest';
import {
  updateScheduleForUser,
  deleteScheduleForUser,
} from '@/app/api/schedule/service/repository-mutations';
import { getFirstRunTemplates } from '@/land/missions/first-run-template';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

const [mockTemplate, secondTemplate] = getFirstRunTemplates();

describe('extracted-helpers-coverage-boost-part2', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('template-configurator-cards', () => {
    it('resolves translated and fallback template text across fields and locales', () => {
      const tMock = (k: string) => (k.includes('badge') ? 'Best' : k);
      expect(getFirstRunTemplateText(tMock, mockTemplate, 'badge', 'en')).toBe('Best');
      expect(getFirstRunTemplateText(tMock, mockTemplate, 'name', 'vi')).toBe(mockTemplate.name.vi);
      expect(getFirstRunTemplateText(tMock, mockTemplate, 'description', 'en')).toBe(mockTemplate.description.en);

      const fallbackTmpl = { ...mockTemplate, badge: { en: 'FallbackEN', vi: undefined as unknown as string } };
      const throwingT = () => { throw new Error('fail'); };
      expect(getFirstRunTemplateText(throwingT, fallbackTmpl, 'badge', 'vi')).toBe('FallbackEN');
    });

    it('renders TemplateCardGrid and handles selection click for both selected and unselected cards', () => {
      const onSelect = vi.fn();
      const { getAllByRole } = render(
        React.createElement(TemplateCardGrid, {
          t: (k: string) => k,
          templates: [mockTemplate, secondTemplate],
          selectedTemplate: mockTemplate,
          onSelectTemplate: onSelect,
          locale: 'en',
        })
      );
      const btns = getAllByRole('button');
      fireEvent.click(btns[1]);
      expect(onSelect).toHaveBeenCalledWith(secondTemplate);
    });
  });

  describe('reset-password-crypto & hmac-webcrypto-digest', () => {
    it('encodes and decodes base64url strings with and without padding', () => {
      expect(fromBase64Url(toBase64Url('abc'))).toBe('abc'); // length % 4 === 0 in base64
      expect(fromBase64Url(toBase64Url('hello'))).toBe('hello');
    });

    it('signs and verifies HMAC signatures and getSecret', async () => {
      const secret = 'super-secret-key-32-chars-long!!';
      const payload = JSON.stringify({ userId: 'u-1', jti: 'jti-1' });
      const sig = await hmacSign(payload, secret);
      expect(await hmacVerify(payload, sig, secret)).toBe(true);
      expect(await hmacVerify(payload, 'short', secret)).toBe(false);
      expect(await hmacVerify(payload, sig.replace('a', 'b'), secret)).toBe(false);

      const prevSecret = process.env.BETTER_AUTH_SECRET;
      delete process.env.BETTER_AUTH_SECRET;
      delete process.env.JWT_SECRET;
      expect(() => getSecret()).toThrow('BETTER_AUTH_SECRET must be set');
      process.env.BETTER_AUTH_SECRET = 'secret-val';
      expect(getSecret()).toBe('secret-val');
      if (prevSecret) process.env.BETTER_AUTH_SECRET = prevSecret;

      expect((await computeHmacSha256Hex('secret-k', 'payload-str')).length).toBe(64);
    });
  });

  describe('repository-mutations', () => {
    it('updates schedule across TABLE_NOT_FOUND, generic error, NOT_FOUND, and success', async () => {
      const { createServerClient } = await import('@/seed/db/client');
      const mockUpdateResult = (res: unknown) => {
        vi.mocked(createServerClient).mockReturnValueOnce({
          from: () => ({ update: () => ({ eq: () => ({ eq: () => ({ returning: async () => res }) }) }) }),
        } as unknown as ReturnType<typeof createServerClient>);
      };

      mockUpdateResult({ error: { code: 'TABLE_NOT_FOUND', message: 'missing' } });
      expect((await updateScheduleForUser('u1', { id: 's1', is_active: false })).code).toBe('TABLE_NOT_FOUND');

      mockUpdateResult({ error: { code: 'DB_ERR', message: 'fail' } });
      expect((await updateScheduleForUser('u1', { id: 's1', interval_days: 7 })).code).toBe('INTERNAL_ERROR');

      mockUpdateResult({ data: [] });
      expect((await updateScheduleForUser('u1', { id: 's1', topic: 'AI' })).code).toBe('NOT_FOUND');

      mockUpdateResult({ data: [{ id: 's1', is_active: 1 }] });
      expect((await updateScheduleForUser('u1', { id: 's1', is_active: true, next_run_date: '2026-10-19' })).data?.id).toBe('s1');
    });

    it('deletes schedule across lookup errors, NOT_FOUND, delete errors, and success', async () => {
      const { createServerClient } = await import('@/seed/db/client');
      const mockDeleteFlow = (lookupRes: unknown, delRes?: unknown) => {
        vi.mocked(createServerClient).mockReturnValueOnce({
          from: () => ({
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => lookupRes }) }) }),
            delete: () => ({ eq: () => ({ eq: async () => delRes }) }),
          }),
        } as unknown as ReturnType<typeof createServerClient>);
      };

      mockDeleteFlow({ data: null, error: { code: 'TABLE_NOT_FOUND', message: 'missing' } });
      expect((await deleteScheduleForUser('u1', 's1')).code).toBe('TABLE_NOT_FOUND');

      mockDeleteFlow({ data: null, error: { code: 'ERR', message: 'fail' } });
      expect((await deleteScheduleForUser('u1', 's1')).code).toBe('INTERNAL_ERROR');

      mockDeleteFlow({ data: null, error: null });
      expect((await deleteScheduleForUser('u1', 's1')).code).toBe('NOT_FOUND');

      mockDeleteFlow({ data: { id: 's1' }, error: null }, { error: { code: 'TABLE_NOT_FOUND', message: 'missing' } });
      expect((await deleteScheduleForUser('u1', 's1')).code).toBe('TABLE_NOT_FOUND');

      mockDeleteFlow({ data: { id: 's1' }, error: null }, { error: { code: 'ERR', message: 'fail' } });
      expect((await deleteScheduleForUser('u1', 's1')).code).toBe('INTERNAL_ERROR');

      mockDeleteFlow({ data: { id: 's1' }, error: null }, { error: null });
      expect((await deleteScheduleForUser('u1', 's1')).data).toBe(true);
    });
  });
});
