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

interface StageStepItemProps {
  id: string;
  label: string;
  state: StepState;
  isLast: boolean;
  isCompletedConnector: boolean;
}

export function StageStepItem({
  id: _id,
  label,
  state,
  isLast,
  isCompletedConnector,
}: StageStepItemProps) {
  return (
    <div role="listitem" style={{ display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minWidth: 72,
        }}
      >
        <StepIcon state={state} />
        <span
          style={{
            fontSize: 11,
            color:
              state === 'completed'
                ? '#16a34a'
                : state === 'failed'
                  ? '#dc2626'
                  : state === 'current'
                    ? '#2563eb'
                    : '#9ca3af',
            fontWeight: state === 'current' ? 600 : 400,
            textAlign: 'center',
            maxWidth: 72,
            lineHeight: '1.2',
          }}
        >
          {label}
        </span>
      </div>
      {!isLast && (
        <div
          aria-hidden="true"
          style={{
            height: 2,
            width: 24,
            background: isCompletedConnector ? '#16a34a' : '#e5e7eb',
            flexShrink: 0,
            marginBottom: 20,
          }}
        />
      )}
    </div>
  );
}
