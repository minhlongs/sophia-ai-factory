import React from 'react';
import type { WorkflowStationId } from '@/tree/mission/workflow-view-model';

interface StationProps {
  x: number;
  y: number;
  isSelected: boolean;
  strokeColor: string;
  badgeBg: string;
  badgeText: string;
  order: number;
  title: string;
  tag: string;
  statusText: string;
}

export function AssemblyLineStationNode({
  id,
  x,
  y,
  isSelected,
  strokeColor,
  badgeBg,
  badgeText,
  order,
  title,
  tag,
  statusText,
}: StationProps & { id: WorkflowStationId }) {
  return (
    <g
      className={`station-node transition-transform duration-200 cursor-pointer ${
        isSelected ? 'scale-105' : 'hover:opacity-95'
      }`}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      {/* Station Isometric Chassis Base */}
      <polygon
        points={`${x},${y - 40} ${x + 60},${y - 10} ${x},${y + 20} ${x - 60},${y - 10}`}
        fill="#FFFFFF"
        className="dark:fill-[#161926]"
        stroke={strokeColor}
        strokeWidth={isSelected ? '2.5' : '1.5'}
        strokeLinejoin="round"
      />

      {/* Station Left Wall */}
      <polygon
        points={`${x - 60},${y - 10} ${x},${y + 20} ${x},${y + 40} ${x - 60},${y + 10}`}
        fill="#F1F5F9"
        className="dark:fill-[#0F111A]"
        stroke={strokeColor}
        strokeWidth={isSelected ? '2' : '1'}
        strokeLinejoin="round"
      />

      {/* Station Right Wall */}
      <polygon
        points={`${x},${y + 20} ${x + 60},${y - 10} ${x + 60},${y + 10} ${x},${y + 40}`}
        fill="#E2E8F0"
        className="dark:fill-[#1A1D2B]"
        stroke={strokeColor}
        strokeWidth={isSelected ? '2' : '1'}
        strokeLinejoin="round"
      />

      {/* Technical Station Module Tower */}
      {id === 'intake_brief' && (
        <path
          d={`M${x - 20},${y - 15} L${x},${y - 35} L${x + 20},${y - 15} L${x},${y + 5} Z`}
          fill="#4338CA"
          fillOpacity="0.15"
          stroke="#4338CA"
          strokeWidth="1.5"
        />
      )}
      {id === 'script_planning' && (
        <rect
          x={x - 16}
          y={y - 25}
          width="32"
          height="20"
          rx="3"
          fill="#4338CA"
          fillOpacity="0.15"
          stroke="#4338CA"
          strokeWidth="1.5"
          transform={`rotate(-15, ${x}, ${y - 15})`}
        />
      )}
      {id === 'ceo_approval_gate' && (
        <path
          d={`M${x},${y - 35} L${x + 18},${y - 20} L${x + 18},${y + 2} L${x},${y + 15} L${x - 18},${y + 2} L${x - 18},${y - 20} Z`}
          fill="#D97706"
          fillOpacity="0.18"
          stroke="#D97706"
          strokeWidth="1.5"
        />
      )}
      {id === 'media_render' && (
        <circle
          cx={x}
          cy={y - 10}
          r="16"
          fill="#4338CA"
          fillOpacity="0.15"
          stroke="#4338CA"
          strokeWidth="1.5"
        />
      )}
      {id === 'publish_ledger' && (
        <path
          d={`M${x - 15},${y - 10} L${x},${y - 32} L${x + 15},${y - 10} L${x},${y + 12} Z`}
          fill="#059669"
          fillOpacity="0.18"
          stroke="#059669"
          strokeWidth="1.5"
        />
      )}

      {/* Station Order Badge */}
      <circle cx={x} cy={y - 10} r="10" fill={badgeBg} />
      <text
        x={x}
        y={y - 6}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill={badgeText}
        fontFamily="ui-monospace, monospace"
      >
        0{order}
      </text>

      {/* Station Labels */}
      <text
        x={x}
        y={y + 60}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        className="fill-slate-900 dark:fill-slate-100"
      >
        {title}
      </text>
      <text
        x={x}
        y={y + 76}
        textAnchor="middle"
        fontSize="10"
        className="fill-slate-500 dark:fill-slate-400 font-mono"
      >
        {tag}
      </text>
      <text
        x={x}
        y={y + 92}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={strokeColor}
        className="font-mono"
      >
        {statusText}
      </text>
    </g>
  );
}
