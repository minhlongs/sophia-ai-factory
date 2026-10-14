export function getSentryDsn(): string {
  return process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
}

export function getHoneycombDataset(): string {
  return process.env.HONEYCOMB_DATASET || 'sophia-prod';
}

export function getOtelSampleRate(): string {
  return process.env.OTEL_SAMPLERATE || '0.01';
}

export function hasHoneycombApiKey(): boolean {
  return !!(process.env.HONEYCOMB_API_KEY ?? '');
}

export function hasSentryDsn(): boolean {
  return getSentryDsn().length > 0;
}
