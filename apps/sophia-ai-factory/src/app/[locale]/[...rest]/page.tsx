import { notFound } from 'next/navigation';

/**
 * Unmatched URLs never enter the [locale] segment on their own, so the branded
 * not-found.tsx in this segment would never render. This catch-all matches any
 * otherwise-unresolved path under a locale and triggers that boundary.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
