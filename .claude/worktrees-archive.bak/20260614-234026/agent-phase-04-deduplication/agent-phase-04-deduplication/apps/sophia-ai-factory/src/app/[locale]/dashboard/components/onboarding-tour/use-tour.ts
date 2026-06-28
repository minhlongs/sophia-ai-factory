"use client";

/**
 * useTour — state + side-effects hook for OnboardingTourModal.
 * Manages visibility, step, completing flag, focus restore, and keyboard close.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { STORAGE_KEY } from './tour-steps';

export interface UseTourOptions {
  userId: string;
  onComplete?: () => void;
}

export function useTour({ userId, onComplete }: UseTourOptions) {
  const router = useRouter();
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    const replay = new URLSearchParams(window.location.search).get('replayTour') === '1';
    if (!dismissed || replay) {
      triggerRef.current = document.activeElement as HTMLElement;
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    triggerRef.current?.focus();
  }

  async function handleFinish() {
    setCompleting(true);
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true, user_id: userId }),
      });
    } catch {
      // non-critical — localStorage still prevents re-show
    }
    localStorage.setItem(STORAGE_KEY, '1');
    setCompleting(false);
    setVisible(false);
    triggerRef.current?.focus();
    onComplete?.();
  }

  async function handleActionNav(href: string) {
    await handleFinish();
    const localized = locale && locale !== 'en' && href.startsWith('/') ? `/${locale}${href}` : href;
    router.push(localized);
  }

  const handleFocusTrap = useCallback((e: React.KeyboardEvent, dialogRef: React.RefObject<HTMLDivElement | null>) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return { visible, step, setStep, completing, handleSkip, handleFinish, handleActionNav, handleFocusTrap };
}
