/**
 * Bluesky Post Text and Facet Formatter
 * Layer: FOREST (Infrastructure Orchestration)
 */

import type { PublishMeta } from '../publisher-interface';
import { MAX_POST_LENGTH } from './types';

export function buildPostText(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ? `\n\n${meta.productLink}` : '';
  const full = `${adCaption}${tags ? ` ${tags}` : ''}${link}`;
  return full.length > MAX_POST_LENGTH ? full.slice(0, MAX_POST_LENGTH - 1) + '…' : full;
}

export interface RichTextFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: string; tag: string }>;
}

export function buildFacets(text: string, hashtags: string[]): RichTextFacet[] {
  const facets: RichTextFacet[] = [];
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);

  for (const tag of hashtags) {
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
    const tagBytes = encoder.encode(normalizedTag);
    let offset = 0;
    while (offset < textBytes.length) {
      const slice = textBytes.slice(offset, offset + tagBytes.length);
      if (slice.every((b, i) => b === tagBytes[i])) {
        facets.push({
          index: { byteStart: offset, byteEnd: offset + tagBytes.length },
          features: [{ $type: 'app.bsky.richtext.facet#tag', tag: normalizedTag.slice(1) }],
        });
        break;
      }
      offset++;
    }
  }

  return facets;
}
