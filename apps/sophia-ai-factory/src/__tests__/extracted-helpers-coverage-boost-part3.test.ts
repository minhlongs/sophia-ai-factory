/**
 * Targeted branch coverage suite part 3 (< 180 LOC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGenerateScriptPost } from '@/app/api/creative-studio/scripts/templates/template-route-handlers';
import { provisionDemoSandbox } from '@/tree/sales/sandbox/provisioner';
import {
  resolveCleanHtmlFile,
  synchronizeStitchIframeDom,
} from '@/components/stitch/screens/control-deck/stitch-screen-live-canvas-helpers';
import { NextRequest } from 'next/server';
import type { D1Database } from '@/seed/db/client';

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/seed/db/resolve-user-tier', () => ({ resolveUserTier: vi.fn() }));
vi.mock('@/land/templates/campaign-templates', () => ({ getTemplateById: vi.fn() }));
vi.mock('@/tree/sales/enterprise-deal-repo', () => ({
  getEnterpriseDealById: vi.fn(),
  updateEnterpriseDeal: vi.fn(),
}));
vi.mock('@/tree/sales/sandbox/host-org-resolver', () => ({
  resolveHostAgencyOrg: vi.fn().mockResolvedValue('org-host-1'),
}));
vi.mock('@/tree/sales/sandbox/sandbox-reuse-helper', () => ({
  tryReuseExistingSandbox: vi.fn(),
}));

describe('extracted-helpers-coverage-boost-part3', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('template-route-handlers', () => {
    it('covers 401 unauthorized, 403 invalid tier, 400 malformed JSON, and 400 invalid schema', async () => {
      const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
      const { resolveUserTier } = await import('@/seed/db/resolve-user-tier');

      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', { method: 'POST', body: '{}' }))).status).toBe(401);

      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1' } as never);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('UNKNOWN_TIER' as never);
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', { method: 'POST', body: '{}' }))).status).toBe(403);

      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1' } as never);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('BASIC');
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', { method: 'POST', body: 'bad{' }))).status).toBe(400);

      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1' } as never);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('BASIC');
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', { method: 'POST', body: '{}' }))).status).toBe(400);
    });

    it('covers 404 missing template, 403 insufficient tier, 200 success (EN & VI), and 500 catch', async () => {
      const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
      const { resolveUserTier } = await import('@/seed/db/resolve-user-tier');
      const { getTemplateById } = await import('@/land/templates/campaign-templates');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
      vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

      vi.mocked(getTemplateById).mockReturnValueOnce(undefined);
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', {
        method: 'POST', body: JSON.stringify({ templateId: 't-miss', topic: 'AI Growth', targetDuration: 60, language: 'en' }),
      }))).status).toBe(404);

      vi.mocked(getTemplateById).mockReturnValueOnce({ id: 't-vip', category: 'viral' as never, defaults: { tone: 'bold' } } as never);
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', {
        method: 'POST', body: JSON.stringify({ templateId: 't-vip', topic: 'AI Growth', targetDuration: 60, language: 'en' }),
      }))).status).toBe(403);

      const mockValidTmpl = {
        id: 't-ok', category: 'welcome' as never,
        defaults: { tone: 'friendly' },
        sections: [{ id: 'hook', label: { en: 'Hook', vi: 'Mở đầu' }, promptTemplate: { en: '{topic} {brandName}', vi: '{topic} {brandName}' }, defaultDurationRatio: 1 }],
        ctaOptions: { en: ['Subscribe'], vi: ['Đăng ký'] },
      };
      vi.mocked(getTemplateById).mockReturnValueOnce(mockValidTmpl as never);
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', {
        method: 'POST', body: JSON.stringify({ templateId: 't-ok', topic: 'AI Growth', targetDuration: 60, language: 'vi' }),
      }))).status).toBe(200);

      vi.mocked(getTemplateById).mockReturnValueOnce(mockValidTmpl as never);
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', {
        method: 'POST', body: JSON.stringify({ templateId: 't-ok', topic: 'AI Growth', brandName: 'Sophia', tone: 'pro', targetDuration: 60, language: 'en' }),
      }))).status).toBe(200);

      vi.mocked(getCurrentUser).mockRejectedValueOnce('Non-error string crash');
      expect((await handleGenerateScriptPost(new NextRequest('http://localhost/t', { method: 'POST', body: '{}' }))).status).toBe(500);
    });
  });

  describe('stitch-screen-live-canvas-helpers & sandbox reuse', () => {
    it('synchronizes Stitch iframe DOM with and without setLang and intercepts links', () => {
      expect(resolveCleanHtmlFile({ htmlFile: '/index.html', routeHtml: '/index.html' } as never)).toBe('index.html');
      expect(resolveCleanHtmlFile({ routeHtml: '/pricing.html' } as never)).toBe('pricing.html');

      const doc = document.implementation.createHTMLDocument('stitch');
      doc.body.innerHTML = '<nav>Nav</nav><div data-en="Hello" data-vi="Xin chào"></div><a href="/pricing.html">Pricing</a>';
      const onSelect = vi.fn();

      const onHeight = vi.fn();

      const fakeIframeNoSetLang = { contentWindow: {}, contentDocument: doc } as unknown as HTMLIFrameElement;
      synchronizeStitchIframeDom({
        iframe: fakeIframeNoSetLang,
        lang: 'vi',
        screens: [{ id: 'pricing', htmlFile: 'pricing.html', routeHtml: '/pricing.html' } as never],
        onSelectScreen: onSelect,
        onMeasureHeight: onHeight,
      });
      expect(doc.querySelector('[data-en]')?.textContent).toBe('Xin chào');
      const link = doc.querySelector('a') as HTMLAnchorElement;
      link.onclick?.(new PointerEvent('click'));
      expect(onSelect).toHaveBeenCalledWith('pricing');
      expect(onHeight).toHaveBeenCalled();

      const setLangFn = vi.fn();
      const fakeIframeWithSetLang = { contentWindow: { setLang: setLangFn }, contentDocument: doc } as unknown as HTMLIFrameElement;
      synchronizeStitchIframeDom({
        iframe: fakeIframeWithSetLang, lang: 'en', screens: [], onSelectScreen: onSelect, onMeasureHeight: onHeight,
      });
      expect(setLangFn).toHaveBeenCalledWith('en');
    });

    it('reuses sandbox when present and throws when deal missing', async () => {
      const { getEnterpriseDealById } = await import('@/tree/sales/enterprise-deal-repo');
      vi.mocked(getEnterpriseDealById).mockResolvedValueOnce(null);
      await expect(provisionDemoSandbox({} as D1Database, 'd-miss')).rejects.toThrow('Enterprise deal not found');

      vi.mocked(getEnterpriseDealById).mockResolvedValueOnce({ id: 'd-ok', companyName: 'Acme', dealStage: 'demo_active' } as never);
      const { tryReuseExistingSandbox } = await import('@/tree/sales/sandbox/sandbox-reuse-helper');
      vi.mocked(tryReuseExistingSandbox).mockResolvedValueOnce({
        dealId: 'd-ok', subaccountId: 'sub-1', subaccountName: 'Acme', slug: 's', allocatedMcu: 1000,
        expiresAt: 999, sandboxToken: 'tok', demoMagicUrl: 'https://t/tok', watermarkEnabled: true,
      });
      expect((await provisionDemoSandbox({} as D1Database, 'd-ok')).subaccountId).toBe('sub-1');
    });
  });
});
