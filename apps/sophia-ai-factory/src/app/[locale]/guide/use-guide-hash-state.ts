/**
 * use-guide-hash-state.ts
 * Hydration-safe URL-hash store for the interactive guide workbench.
 * The hash is the single source of truth, so deep links survive re-renders.
 */

'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  formatGuideHash,
  parseGuideHash,
  stepGuideTarget,
  type GuideActiveTarget,
} from '@/seed/guide';

export interface GuideHashState {
  readonly target: GuideActiveTarget;
  readonly setTarget: (next: GuideActiveTarget) => void;
  readonly step: (delta: -1 | 1) => void;
}

interface HashCacheEntry {
  readonly hash: string;
  readonly target: GuideActiveTarget;
}

export function useGuideHashState(initial: GuideActiveTarget): GuideHashState {
  // `initial` is a server-derived constant for this page, so a plain closure is
  // enough for the server snapshot; the cache only exists to keep getSnapshot
  // referentially stable for useSyncExternalStore when the hash is unchanged.
  const cacheRef = useRef<HashCacheEntry | null>(null);

  const getSnapshot = useCallback((): GuideActiveTarget => {
    const hash = window.location.hash;
    const cached = cacheRef.current;
    if (cached !== null && cached.hash === hash) return cached.target;
    const target = parseGuideHash(hash) ?? initial;
    cacheRef.current = { hash, target };
    return target;
  }, [initial]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    const listener = () => onStoreChange();
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);

  const target = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTarget = useCallback((next: GuideActiveTarget) => {
    window.history.replaceState(null, '', formatGuideHash(next));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);

  const step = useCallback(
    (delta: -1 | 1) => setTarget(stepGuideTarget(target, delta)),
    [setTarget, target],
  );

  return { target, setTarget, step };
}
