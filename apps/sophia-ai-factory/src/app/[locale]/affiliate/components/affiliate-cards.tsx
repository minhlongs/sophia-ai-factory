import React from 'react';

export function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
      <div className="inline-flex p-2 rounded-lg bg-primary-500/10 text-primary-400">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export function StepCard({
  step,
  title,
  description,
}: {
  step?: number;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-2">
      {step !== undefined && (
        <div className="w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 text-sm font-bold flex items-center justify-center mb-3">
          {step}
        </div>
      )}
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
