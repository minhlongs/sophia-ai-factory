'use client';
/**
 * Incident card — shows title, duration, postmortem link.
 * @module app/status/incident-card
 */

import type { StatusIncident } from '@/land/status/status-store';

interface IncidentCardProps {
  incident: StatusIncident;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  major: 'text-amber-400',
  minor: 'text-muted-foreground',
};

export function IncidentCard({ incident }: IncidentCardProps) {
  const durationMs = incident.endedAt
    ? (incident.endedAt - incident.startedAt) * 1000
    : null;
  const durationLabel = durationMs ? formatDuration(durationMs) : 'Ongoing';

  return (
    <div className="border-l-2 border-border pl-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{incident.title}</p>
          {incident.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{incident.description}</p>
          )}
        </div>
        <span className={`text-xs font-medium whitespace-nowrap ${SEVERITY_COLORS[incident.severity] ?? 'text-muted-foreground'}`}>
          {incident.severity}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(incident.startedAt * 1000))}</span>
        <span>Duration: {durationLabel}</span>
        {incident.postmortemUrl && (
          <a href={incident.postmortemUrl} className="text-violet-400 hover:underline" target="_blank" rel="noopener noreferrer">
            Post-mortem
          </a>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}
