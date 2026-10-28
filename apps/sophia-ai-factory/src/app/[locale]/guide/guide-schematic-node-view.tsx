/**
 * guide-schematic-node-view.tsx
 * One clickable schematic node: a station block or a pillar chip.
 * Layer: app/[locale]/guide (presentation only; geometry comes from the topology module)
 */

'use client';

// i18n-namespace: guide

import { type KeyboardEvent } from 'react';
import type { GuideActiveTarget } from '@/seed/guide';
import { type GuideCanvasNode, type GuideSchematicCanvasLabels } from './guide-schematic-nodes';

export interface NodeViewProps {
  readonly node: GuideCanvasNode;
  readonly labels: GuideSchematicCanvasLabels;
  readonly onSelect: (target: GuideActiveTarget) => void;
  readonly onKeyDown: (event: KeyboardEvent, target: GuideActiveTarget) => void;
}

export function GuideCanvasNodeView({ node, labels, onSelect, onKeyDown }: NodeViewProps) {
  return (
    <g
      role="button"
      tabIndex={0}
      onClick={() => onSelect(node.target)}
      onKeyDown={(event) => onKeyDown(event, node.target)}
      aria-label={`${node.ariaPrefix} 0${node.order} · ${node.name} · ${node.isActive ? labels.selected : labels.idle}`}
      className="cursor-pointer"
    >
      <rect
        x={node.cx - node.width / 2}
        y={node.cy - node.height / 2}
        width={node.width}
        height={node.height}
        rx={node.radius}
        className={node.isActive ? 'fill-card stroke-accent' : 'fill-card stroke-border'}
        strokeWidth={node.isActive ? 2.5 : 1.5}
      />
      <text
        x={node.cx}
        y={node.cy + 3}
        textAnchor="middle"
        fontSize={9}
        fontWeight="bold"
        className={node.isActive ? 'fill-accent' : 'fill-foreground'}
      >
        {node.caption}
      </text>
      {node.isActive && (
        <circle cx={node.cx + node.width / 2 - 8} cy={node.cy - node.height / 2 - 6} r="4" className="guide-pulse-orb" />
      )}
    </g>
  );
}
