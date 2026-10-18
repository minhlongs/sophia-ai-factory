'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import type { ProjectCard } from './dashboard-shell-types';

export function DashboardProjectCard({ project }: { project: ProjectCard }) {
  return (
    <div className="group bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden hover:border-primary/50 transition-all cursor-pointer">
      <div className="aspect-video bg-gradient-to-br from-surface-container to-surface-container-low relative overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-surface-container-lowest to-surface-container" />
        {project.isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
            <svg className="w-8 h-8 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        <div className="absolute bottom-2 left-2 w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          <Eye className="w-5 h-5" />
        </div>
        <span className="absolute top-2 right-2 text-xs bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded font-normal">
          {project.duration}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <h4 className="font-bold text-on-surface text-sm truncate">
          {project.title}
        </h4>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-on-surface-variant">
            {project.modifiedLabel}
          </span>
          {project.statusLabel && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
              {project.isRendering ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              <span className="text-xs">{project.statusLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
