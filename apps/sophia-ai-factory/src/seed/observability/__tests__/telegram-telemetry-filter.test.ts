// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildClientOptions, buildEdgeOptions, buildServerOptions } from '../sentry-options';
import { registerOpsTelemetrySecret, scrubTelegramTelemetry, TELEGRAM_FETCH_IGNORE } from '../telegram-telemetry-filter';
const url = 'https://api.telegram.org/botnot-a-real-fixture-token/sendMessage';

describe('Telegram credential telemetry filtering', () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  it('scrubs nested requests, exception messages, span descriptions, breadcrumbs and standalone configured token', () => {
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', 'not-a-real-fixture-token');
    const event = { request: { url }, exception: { values: [{ value: `fetch failed ${url}` }] },
      spans: [{ description: url, data: { 'http.url': url } }], extra: { arbitrary: 'not-a-real-fixture-token' } };
    const result = JSON.stringify(scrubTelegramTelemetry(event));
    expect(result).not.toContain('not-a-real-fixture-token');
    expect(result).toContain('[Filtered]');
  });
  it.each([buildClientOptions, buildServerOptions, buildEdgeOptions])('preserves Sentry tracking with runtime hooks %s', (build) => {
    const options = build();
    const event = { message: url, request: { url }, exception: { values: [{ value: url }] } };
    const beforeSend = options.beforeSend;
    expect(beforeSend).toBeTypeOf('function');
    const result = beforeSend?.({ ...event, type: undefined }, {});
    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain('not-a-real-fixture-token');
    const crumb = options.beforeBreadcrumb?.({ category: 'fetch', data: { url }, message: url }, {});
    expect(JSON.stringify(crumb)).not.toContain('not-a-real-fixture-token');
    expect(options.beforeSendSpan).toBe(scrubTelegramTelemetry);
    expect(options.beforeSendTransaction).toBe(scrubTelegramTelemetry);
    const span = { description: url, data: { 'url.full': url } };
    expect(JSON.stringify(scrubTelegramTelemetry(span))).not.toContain('not-a-real-fixture-token');
  });
  it('scrubs standalone Worker binding secrets absent process.env', () => {
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', '');
    registerOpsTelemetrySecret('not-real-worker-only');
    expect(scrubTelegramTelemetry({ message: 'not-real-worker-only' }).message).toBe('[Filtered]');
  });
  it('excludes only Telegram Bot API fetch spans, not unrelated monitoring', () => {
    expect(TELEGRAM_FETCH_IGNORE.test(url)).toBe(true);
    expect(TELEGRAM_FETCH_IGNORE.test('https://api.telegram.org.evil.invalid/botx')).toBe(false);
    expect(TELEGRAM_FETCH_IGNORE.test('https://api.openrouter.ai/chat')).toBe(false);
  });
});
