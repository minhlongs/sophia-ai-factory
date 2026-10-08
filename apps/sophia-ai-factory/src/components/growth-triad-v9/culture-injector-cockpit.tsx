import React from 'react';

export interface AlignmentAxis {
  label: string;
  value: number; // 0 to 100
}

export interface CultureInjectorCockpitProps {
  title?: string;
  profileName: string;
  axes: AlignmentAxis[];
  className?: string;
}

export function CultureInjectorCockpit({ title = 'Cultural Alignment Index (CAI)', profileName, axes, className = '' }: CultureInjectorCockpitProps) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-6 text-white shadow-xl ${className}`}>
      <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-violet-500">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">Target Profile: <span className="font-medium text-gray-200">{profileName}</span></p>
        </div>
        <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">Injecting</span>
      </div>

      <div className="space-y-4">
        {axes.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">No alignment data available.</div>
        ) : (
          <div className="grid gap-3">
            {axes.map((axis, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">{axis.label}</span>
                  <span className="font-mono text-gray-400">{axis.value}%</span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, axis.value))}%` }}
                  />
                  <div className="absolute inset-y-0 left-[80%] w-0.5 bg-gray-400/50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-gray-800 pt-4 flex justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-violet-500"></div> Current Alignment
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-0.5 bg-gray-400/50"></div> Threshold (80%)
        </div>
      </div>
    </div>
  );
}
