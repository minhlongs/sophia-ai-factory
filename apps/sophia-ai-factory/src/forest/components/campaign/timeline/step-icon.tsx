// i18n-namespace: campaign
'use client';

import type { StepState } from './types';

export function StepIcon({ state }: { state: StepState }) {
  if (state === 'completed') {
    return (
      <span
        aria-label="Completed"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#16a34a',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        ✓
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span
        aria-label="Failed"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#dc2626',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        ✕
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span
        aria-label="In progress"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 700,
          fontSize: 12,
          animation: 'spin 1s linear infinite',
        }}
      >
        ◌
      </span>
    );
  }
  return (
    <span
      aria-label="Pending"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: '#d1d5db',
        color: '#6b7280',
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      ○
    </span>
  );
}
