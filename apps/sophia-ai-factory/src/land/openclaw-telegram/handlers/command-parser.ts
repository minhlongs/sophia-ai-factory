export interface ParsedTranslateArg {
  toLang: string;
  text: string;
}

export function parseTranslateArg(rawArg: string): ParsedTranslateArg | null {
  const arg = rawArg.trim();
  const firstSpace = arg.indexOf(' ');
  if (firstSpace < 2) return null;
  const toLang = arg.slice(0, firstSpace).trim();
  const text = arg.slice(firstSpace + 1).trim();
  if (text.length === 0) return null;
  return { toLang, text };
}

export interface ParsedCloneVoiceArg {
  name: string;
  audioUrls: string[];
}

export function parseCloneVoiceArg(rawArg: string): ParsedCloneVoiceArg | null {
  const arg = rawArg.trim();
  const pipe = arg.indexOf('|');
  if (pipe < 1) return null;
  const name = arg.slice(0, pipe).trim();
  const audioUrls = arg
    .slice(pipe + 1)
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (audioUrls.length === 0) return null;
  return { name, audioUrls };
}

export interface ParsedSeoScriptArg {
  topic: string;
  keywords: string[];
}

export function parseSeoScriptArg(rawArg: string): ParsedSeoScriptArg | null {
  const arg = rawArg.trim();
  if (arg.length === 0) return null;
  const pipe = arg.indexOf('|');
  const topic = pipe >= 0 ? arg.slice(0, pipe).trim() : arg;
  const keywords =
    pipe >= 0
      ? arg.slice(pipe + 1).split(',').map((k) => k.trim()).filter((k) => k.length > 0)
      : [];
  return { topic, keywords };
}

export interface ParsedPublishArg {
  videoId: string;
  channelId: string;
  scheduledAt: number;
  caption?: string;
}

export function parsePublishArg(rawArg: string): { parsed: ParsedPublishArg | null; error?: string } {
  const parts = rawArg.trim().split(/\s+/);
  if (parts.length < 3) {
    return { parsed: null, error: 'insufficient_args' };
  }
  const [videoId, channelId, isoDate, ...captionParts] = parts;
  const scheduledAt = Math.floor(new Date(isoDate).getTime() / 1000);
  if (!Number.isFinite(scheduledAt) || scheduledAt <= 0) {
    return { parsed: null, error: `invalid_date:${isoDate}` };
  }
  return {
    parsed: {
      videoId,
      channelId,
      scheduledAt,
      caption: captionParts.length > 0 ? captionParts.join(' ') : undefined,
    },
  };
}

export function parseFree100Email(rawArg: string): string | null {
  const email = rawArg.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}
