import type { AssetType, AssetLimits } from './types';

export function validateAssetFile(file: File, type: AssetType, limits: AssetLimits): string | null {
  if (file.size > limits.maxBytes) {
    return `File too large (max ${limits.maxBytes / 1024 / 1024}MB)`;
  }

  if (type === 'font') {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
      return 'Invalid font file — use .ttf, .otf, .woff, or .woff2';
    }
  } else if (!file.type.startsWith(limits.mimePrefix)) {
    return `Invalid file type for ${type}`;
  }

  return null;
}
