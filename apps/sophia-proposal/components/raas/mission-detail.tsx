'use client';

/**
 * Mission Detail
 * Single mission view: status timeline (PEV stages), execution log, result, MCU cost breakdown.
 */

import { useEffect, useState } from 'react';

type MissionStatus = 'queued' | 'planning' | 'executing' | 'verifying' | 'completed' | 'failed';

interface MissionData {
  id: string;
  title: string;
  status: MissionStatus;
  mcuCost: number;
  createdAt: string;
  completedAt?: string;
  log?: string[];
  result?: string;
  mcuBreakdown?: { label: string; cost: number }[];
}

const PEV_STAGES: { key: MissionStatus; label: string; icon: string }[] = [
  { key: 'queued', label: 'Queued', icon: 'schedule' },
  { key: 'planning', label: 'Planning', icon: 'psychology' },
  { key: 'executing', label: 'Executing', icon: 'rocket_launch' },
  { key: 'verifying', label: 'Verifying', icon: 'verified' },
  { key: 'completed', label: 'Completed', icon: 'check_circle' },
];

const STATUS_ORDER: MissionStatus[] = ['queued', 'planning', 'executing', 'verifying', 'completed'];

interface Props { missionId: string }

export function MissionDetail({ missionId }: Props) {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/raas/missions/${missionId}`)
      .then(r => r.json())
      .then(d => { setMission(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [missionId]);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)}</div>;
  if (!mission) return <p className="text-gray-500 text-center py-12">Mission not found.</p>;

  const currentIdx = mission.status === 'failed' ? -1 : STATUS_ORDER.indexOf(mission.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900">{mission.title}</h2>
        <p className="text-sm text-gray-500 mt-1">Started {new Date(mission.createdAt).toLocaleString()}</p>
      </div>

      {/* PEV Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">PEV Pipeline</h3>
        {mission.status === 'failed' ? (
          <div className="flex items-center gap-2 text-red-600">
            <span className="material-symbols-outlined">error</span>
            <span className="font-medium">Mission failed</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {PEV_STAGES.map((stage, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-center ${
                    done ? 'bg-green-50 text-green-700' : active ? 'bg-orange-50 text-orange-700 ring-2 ring-orange-400' : 'bg-gray-50 text-gray-400'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{stage.icon}</span>
                    <span className="text-xs font-medium">{stage.label}</span>
                  </div>
                  {i < PEV_STAGES.length - 1 && <span className="text-gray-300 material-symbols-outlined text-sm">chevron_right</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution Log */}
      {mission.log && mission.log.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Execution Log</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs text-green-400">
            {mission.log.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      )}

      {/* Result */}
      {mission.result && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Result</h3>
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">{mission.result}</div>
        </div>
      )}

      {/* MCU Cost Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">MCU Cost Breakdown</h3>
        {mission.mcuBreakdown?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
            <span className="text-gray-600">{item.label}</span>
            <span className="font-medium text-gray-900">{item.cost} MCU</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold pt-2 text-orange-700">
          <span>Total</span>
          <span>{mission.mcuCost} MCU</span>
        </div>
      </div>
    </div>
  );
}
