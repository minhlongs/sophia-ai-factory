"use client";

/**
 * ReplayTourLink — sidebar button to re-trigger the onboarding tour.
 * Clears localStorage gate and navigates to /dashboard?replayTour=1.
 */

import { RotateCcw } from 'lucide-react';

interface ReplayTourLinkProps {
  label: string;
}

export function ReplayTourLink({ label }: ReplayTourLinkProps) {
  function handleClick() {
    try {
      localStorage.removeItem('sophia_tour_dismissed');
    } catch {
      // storage may be unavailable — navigate anyway, modal reads URL param
    }
    window.location.href = '/dashboard?replayTour=1';
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 px-4 py-3 w-full text-left text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
    >
      <RotateCcw className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="font-medium">{label}</span>
    </button>
  );
}
