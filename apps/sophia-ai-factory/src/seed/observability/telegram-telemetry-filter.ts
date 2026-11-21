/** Telegram Bot API authenticates in the path: never export those URLs or credentials. */
export const TELEGRAM_BOT_URL = /https?:\/\/api\.telegram\.org(?::\d+)?\/bot[^\s/"'?#]+(?:\/[^\s"'?#]*)?/gi;
export const TELEGRAM_FETCH_IGNORE = /^https:\/\/api\.telegram\.org\/bot/i;

let runtimeOpsToken: string | undefined;
/** Worker secrets need not be mirrored in process.env; retain only the current ops secret. */
export function registerOpsTelemetrySecret(token: string): void {
  runtimeOpsToken = token;
}

/** Scrub all string fields (exceptions, requests, breadcrumbs, span attributes and names). */
export function scrubTelegramTelemetry<T>(value: T): T {
  const seen = new WeakSet<object>();
  const scrub = (item: unknown): unknown => {
    if (typeof item === 'string') {
      let text = item.replace(TELEGRAM_BOT_URL, 'https://api.telegram.org/bot[Filtered]');
      for (const token of [runtimeOpsToken, process.env.TELEGRAM_OPS_BOT_TOKEN]) {
        if (token) text = text.split(token).join('[Filtered]').split(encodeURIComponent(token)).join('[Filtered]');
      }
      return text;
    }
    if (!item || typeof item !== 'object' || seen.has(item)) return item;
    seen.add(item);
    for (const key of Object.keys(item)) {
      const object = item as Record<string, unknown>;
      object[key] = scrub(object[key]);
    }
    return item;
  };
  return scrub(value) as T;
}
