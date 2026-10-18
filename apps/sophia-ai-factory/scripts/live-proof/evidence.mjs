import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createEvidenceRecorder(evidencePath, { schema = 'sophia-live-user-video-flow-proof-v1' } = {}) {
  const context = {};
  const events = [];

  function sanitize(value) {
    if (typeof value === 'string') {
      return value
        .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/https?:\/\/[^\s"'<>\\]+/gi, '[URL_REDACTED]')
        .replace(/(api[_-]?key|password|token|secret)["':=\s]+[^"',\s}]+/gi, '$1=[REDACTED]');
    }
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== 'object') return value;

    const redacted = {};
    for (const [key, item] of Object.entries(value)) {
      if (/password|token|secret|api.?key|authorization|cookie/i.test(key)) {
        redacted[key] = '[REDACTED]';
      } else if (/video_url|videoUrl|thumbnail_url|thumbnailUrl/i.test(key) && typeof item === 'string') {
        redacted[key] = '[URL_PRESENT]';
      } else {
        redacted[key] = sanitize(item);
      }
    }
    return redacted;
  }

  function record(step, status, data = {}) {
    events.push({
      at: new Date().toISOString(),
      step,
      status,
      data: sanitize(data),
    });
  }

  function write(status, message) {
    if (!evidencePath) return;

    const targetPath = resolve(evidencePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(
      targetPath,
      `${JSON.stringify({
        schema,
        status,
        message: sanitize(message),
        generatedAt: new Date().toISOString(),
        context: sanitize(context),
        events,
      }, null, 2)}\n`,
    );
  }

  return { context, record, write };
}
