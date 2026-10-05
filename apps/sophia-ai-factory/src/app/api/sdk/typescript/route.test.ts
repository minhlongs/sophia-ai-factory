import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/sdk/typescript', () => {
  it('returns text/typescript content with cache headers and filename', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/typescript');
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="sophia.ts"');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');

    const body = await res.text();
    expect(body).toContain('export class SophiaClient');
    expect(body).toContain('readonly missions =');
    expect(body).toContain('readonly credits =');
    expect(body).toContain('readonly algorithms =');
    expect(body).toContain('affiliateDescription');
    expect(body).toContain('translate');
    expect(body).toContain('cloneVoice');
    expect(body).toContain('seoScript');
    expect(body).toContain('liveStats');
    expect(body).toContain('schedulePublish');
    expect(body).toContain('registerChannel');
  });
});
