/**
 * Unit Tests for Anycast Sub-50ms Edge Mesh KV Router & 12-Language Negotiation
 *
 * Layer: tree/localization/__tests__
 * Validates geo-IP mapping, Cloudflare Ray colo extraction, RFC 5646 Accept-Language parsing,
 * RTL detection, SWR cache headers, and Edge KV routing.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseEnterpriseAcceptLanguage,
  extractColoFromRay,
  resolveEdgeMeshRegion,
  extractLocaleFromCookie,
  extractLocaleFromPathname,
  resolveEnterpriseLocale,
  makeEdgeRoutingDecision,
  buildSwrCacheHeaders,
  buildEdgeRouteCacheKey,
  resolveEdgeRoutingWithKv,
  formatLocalizedEnterprisePath,
  type EdgeKvStore,
} from '../edge-mesh-router';
import {
  ENTERPRISE_12_LOCALES,
  isEnterpriseLocale,
  isRtlLocale,
} from '@/seed/types/edge-mesh';

describe('Edge Mesh & 12-Language Router', () => {
  describe('Seed Locale Constants & RTL Predicates', () => {
    it('defines exactly 12 enterprise locales', () => {
      expect(ENTERPRISE_12_LOCALES).toHaveLength(12);
      expect(ENTERPRISE_12_LOCALES).toEqual([
        'en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'th', 'id', 'hi', 'ar',
      ]);
    });

    it('identifies valid enterprise locales with case-insensitivity and prefix handling', () => {
      expect(isEnterpriseLocale('en')).toBe(true);
      expect(isEnterpriseLocale('VI')).toBe(true);
      expect(isEnterpriseLocale('ja-JP')).toBe(true);
      expect(isEnterpriseLocale('zh-CN')).toBe(true);
      expect(isEnterpriseLocale('ar-SA')).toBe(true);
      expect(isEnterpriseLocale('hi-IN')).toBe(true);
      expect(isEnterpriseLocale('de-DE')).toBe(true);
      expect(isEnterpriseLocale('fr-FR')).toBe(true);
      expect(isEnterpriseLocale('es-ES')).toBe(true);
      expect(isEnterpriseLocale('id-ID')).toBe(true);
      expect(isEnterpriseLocale('th-TH')).toBe(true);
      expect(isEnterpriseLocale('ko-KR')).toBe(true);

      expect(isEnterpriseLocale('pt')).toBe(false);
      expect(isEnterpriseLocale('ru')).toBe(false);
      expect(isEnterpriseLocale(null)).toBe(false);
      expect(isEnterpriseLocale('')).toBe(false);
    });

    it('identifies RTL locales accurately for Arabic', () => {
      expect(isRtlLocale('ar')).toBe(true);
      expect(isRtlLocale('ar-EG')).toBe(true);
      expect(isRtlLocale('AR-SA')).toBe(true);
      expect(isRtlLocale('en')).toBe(false);
      expect(isRtlLocale('vi')).toBe(false);
      expect(isRtlLocale('ja')).toBe(false);
      expect(isRtlLocale(null)).toBe(false);
    });
  });

  describe('Colo Extraction & Region Classification', () => {
    it('extracts 3-letter IATA airport colo code from CF-Ray', () => {
      expect(extractColoFromRay('8d26e95c1a8d052b-SIN')).toBe('SIN');
      expect(extractColoFromRay('9a1b2c3d4e-HAN')).toBe('HAN');
      expect(extractColoFromRay('5f6g7h8i9j-FRA')).toBe('FRA');
      expect(extractColoFromRay('12345-DXB')).toBe('DXB');
      expect(extractColoFromRay('99999-IAD')).toBe('IAD');
      expect(extractColoFromRay('invalid-ray')).toBe('GLOBAL');
      expect(extractColoFromRay(null)).toBe('GLOBAL');
    });

    it('maps colos to Edge Mesh Regions', () => {
      expect(resolveEdgeMeshRegion('SIN')).toBe('apac');
      expect(resolveEdgeMeshRegion('HAN')).toBe('apac');
      expect(resolveEdgeMeshRegion('NRT')).toBe('apac');
      expect(resolveEdgeMeshRegion('FRA')).toBe('eu');
      expect(resolveEdgeMeshRegion('LHR')).toBe('eu');
      expect(resolveEdgeMeshRegion('IAD')).toBe('us');
      expect(resolveEdgeMeshRegion('SFO')).toBe('us');
      expect(resolveEdgeMeshRegion('DXB')).toBe('middle_east');
      expect(resolveEdgeMeshRegion('RUH')).toBe('middle_east');
      expect(resolveEdgeMeshRegion('GRU')).toBe('latam');
    });

    it('falls back to country code for unmapped colos', () => {
      expect(resolveEdgeMeshRegion('UNKNOWN', 'SA')).toBe('middle_east');
      expect(resolveEdgeMeshRegion('UNKNOWN', 'JP')).toBe('apac');
      expect(resolveEdgeMeshRegion('UNKNOWN', 'DE')).toBe('eu');
      expect(resolveEdgeMeshRegion('UNKNOWN', 'US')).toBe('us');
      expect(resolveEdgeMeshRegion('UNKNOWN', 'BR')).toBe('latam');
      expect(resolveEdgeMeshRegion('UNKNOWN', 'XX')).toBe('global');
    });
  });

  describe('Accept-Language Header Parsing', () => {
    it('parses complex Accept-Language header and sorts by q-weight descending', () => {
      const header = 'ar-EG;q=0.7, vi-VN;q=0.9, en-US;q=0.8, fr;q=0.5';
      const parsed = parseEnterpriseAcceptLanguage(header);

      expect(parsed).toHaveLength(4);
      expect(parsed[0]).toEqual({ locale: 'vi-vn', primaryCode: 'vi', q: 0.9 });
      expect(parsed[1]).toEqual({ locale: 'en-us', primaryCode: 'en', q: 0.8 });
      expect(parsed[2]).toEqual({ locale: 'ar-eg', primaryCode: 'ar', q: 0.7 });
      expect(parsed[3]).toEqual({ locale: 'fr', primaryCode: 'fr', q: 0.5 });
    });

    it('assigns q=1.0 when quality factor is omitted', () => {
      const header = 'ja-JP, en;q=0.5';
      const parsed = parseEnterpriseAcceptLanguage(header);

      expect(parsed[0]).toEqual({ locale: 'ja-jp', primaryCode: 'ja', q: 1.0 });
      expect(parsed[1]).toEqual({ locale: 'en', primaryCode: 'en', q: 0.5 });
    });

    it('handles empty or malformed inputs safely', () => {
      expect(parseEnterpriseAcceptLanguage(null)).toEqual([]);
      expect(parseEnterpriseAcceptLanguage('')).toEqual([]);
      expect(parseEnterpriseAcceptLanguage('*')).toEqual([]);
    });
  });

  describe('Cookie and Pathname Extraction', () => {
    it('extracts locale from NEXT_LOCALE or locale cookie', () => {
      expect(extractLocaleFromCookie('session=abc; NEXT_LOCALE=ar; theme=dark')).toBe('ar');
      expect(extractLocaleFromCookie('locale=de')).toBe('de');
      expect(extractLocaleFromCookie('session=xyz; NEXT_LOCALE=invalid')).toBeNull();
      expect(extractLocaleFromCookie(null)).toBeNull();
    });

    it('extracts locale from URL pathname prefix', () => {
      expect(extractLocaleFromPathname('/ar/pricing')).toBe('ar');
      expect(extractLocaleFromPathname('/zh/enterprise/demo')).toBe('zh');
      expect(extractLocaleFromPathname('/unsupported/route')).toBeNull();
      expect(extractLocaleFromPathname('/')).toBeNull();
      expect(extractLocaleFromPathname(null)).toBeNull();
    });
  });

  describe('Multi-Tiered Locale Resolution', () => {
    it('prioritizes explicit path locale over cookie and geo', () => {
      const result = resolveEnterpriseLocale({
        pathLocale: 'fr',
        cookieLocale: 'ar',
        geoCountry: 'VN',
        acceptLanguage: 'ja',
      });
      expect(result).toEqual({ locale: 'fr', source: 'path' });
    });

    it('prioritizes cookie locale over geo and browser when path is not localized', () => {
      const result = resolveEnterpriseLocale({
        cookieLocale: 'es',
        geoCountry: 'JP',
        acceptLanguage: 'ja',
      });
      expect(result).toEqual({ locale: 'es', source: 'cookie' });
    });

    it('honors high-preference Accept-Language (q >= 0.85) over geo', () => {
      const result = resolveEnterpriseLocale({
        geoCountry: 'US', // Geo suggests 'en'
        acceptLanguage: 'de-DE;q=0.95, en;q=0.8',
      });
      expect(result).toEqual({ locale: 'de', source: 'accept-language' });
    });

    it('resolves native country geo-IP when no explicit preference overrides', () => {
      expect(resolveEnterpriseLocale({ geoCountry: 'SA' })).toEqual({ locale: 'ar', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'EG' })).toEqual({ locale: 'ar', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'JP' })).toEqual({ locale: 'ja', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'KR' })).toEqual({ locale: 'ko', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'TH' })).toEqual({ locale: 'th', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'ID' })).toEqual({ locale: 'id', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'IN' })).toEqual({ locale: 'hi', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'CN' })).toEqual({ locale: 'zh', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'ES' })).toEqual({ locale: 'es', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'FR' })).toEqual({ locale: 'fr', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'DE' })).toEqual({ locale: 'de', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'VN' })).toEqual({ locale: 'vi', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'GB' })).toEqual({ locale: 'en', source: 'geo-ip' });
    });

    it('falls back to vi for Vietnam and en for other unmapped requests', () => {
      expect(resolveEnterpriseLocale({ geoCountry: 'VN' })).toEqual({ locale: 'vi', source: 'geo-ip' });
      expect(resolveEnterpriseLocale({ geoCountry: 'ZZ' })).toEqual({ locale: 'en', source: 'fallback' });
      expect(resolveEnterpriseLocale({})).toEqual({ locale: 'en', source: 'fallback' });
    });
  });

  describe('Edge Routing Decision & RTL Flow', () => {
    it('creates complete EdgeRoutingDecision with RTL set for Arabic', () => {
      const decision = makeEdgeRoutingDecision({
        ipCountry: 'SA',
        cfRay: '7a8b9c-DXB',
        acceptLanguage: 'ar-SA,ar;q=0.9',
      });

      expect(decision.detectedLocale).toBe('ar');
      expect(decision.isRtl).toBe(true);
      expect(decision.countryCode).toBe('SA');
      expect(decision.coloCode).toBe('DXB');
      expect(decision.edgeRegion).toBe('middle_east');
      expect(decision.routeCacheTtlSeconds).toBe(300);
      expect(decision.resolutionSource).toBe('accept-language');
    });

    it('creates LTR decision for Japanese Tokyo request', () => {
      const decision = makeEdgeRoutingDecision({
        ipCountry: 'JP',
        cfRay: '12345-NRT',
      });

      expect(decision.detectedLocale).toBe('ja');
      expect(decision.isRtl).toBe(false);
      expect(decision.countryCode).toBe('JP');
      expect(decision.coloCode).toBe('NRT');
      expect(decision.edgeRegion).toBe('apac');
    });
  });

  describe('SWR Cache Headers & KV Edge Caching', () => {
    it('generates Stale-While-Revalidate headers', () => {
      const headers = buildSwrCacheHeaders(300, 86400);
      expect(headers['Cache-Control']).toBe(
        'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
      );
      expect(headers['Cloudflare-CDN-Cache-Control']).toBe(
        'max-age=300, stale-while-revalidate=86400'
      );
    });

    it('constructs deterministic cache keys', () => {
      const key1 = buildEdgeRouteCacheKey({
        ipCountry: 'JP',
        cfRay: '1-NRT',
        acceptLanguage: 'ja-JP',
      });
      const key2 = buildEdgeRouteCacheKey({
        ipCountry: 'JP',
        cfRay: '2-NRT',
        acceptLanguage: 'ja-JP',
      });
      expect(key1).toBe(key2);
    });

    it('retrieves cached decision from KV on hit', async () => {
      const cachedDecision: ReturnType<typeof makeEdgeRoutingDecision> = {
        detectedLocale: 'zh',
        isRtl: false,
        countryCode: 'CN',
        coloCode: 'HKG',
        edgeRegion: 'apac',
        routeCacheTtlSeconds: 300,
        resolutionSource: 'geo-ip',
      };

      const mockKv: EdgeKvStore = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedDecision)),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const result = await resolveEdgeRoutingWithKv(mockKv, {
        ipCountry: 'CN',
        cfRay: '123-HKG',
      });

      expect(result).toEqual(cachedDecision);
      expect(mockKv.get).toHaveBeenCalledTimes(1);
      expect(mockKv.put).not.toHaveBeenCalled();
    });

    it('computes and stores in KV on cache miss', async () => {
      const mockKv: EdgeKvStore = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const result = await resolveEdgeRoutingWithKv(mockKv, {
        ipCountry: 'DE',
        cfRay: '456-FRA',
      });

      expect(result.detectedLocale).toBe('de');
      expect(result.isRtl).toBe(false);
      expect(result.coloCode).toBe('FRA');
      expect(mockKv.get).toHaveBeenCalledTimes(1);
      expect(mockKv.put).toHaveBeenCalledWith(
        expect.stringContaining('edge_route:v1:DE:FRA'),
        expect.stringContaining('"detectedLocale":"de"'),
        { expirationTtl: 300 }
      );
    });
  });

  describe('Path Localization Formatting', () => {
    it('prefixes paths with target enterprise locale', () => {
      expect(formatLocalizedEnterprisePath('/pricing', 'ar')).toBe('/ar/pricing');
      expect(formatLocalizedEnterprisePath('/vi/dashboard', 'fr')).toBe('/fr/dashboard');
      expect(formatLocalizedEnterprisePath('/', 'zh')).toBe('/zh');
      expect(formatLocalizedEnterprisePath('', 'es')).toBe('/es');
    });
  });
});
