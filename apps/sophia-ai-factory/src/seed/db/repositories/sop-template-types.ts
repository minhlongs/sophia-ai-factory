/**
6 * SOP Template Row Types and Mappers
7 * @module seed/db/repositories/sop-template-types
8 */

import type { SOPGraph } from '@/seed/types/sop-dag';

export interface SopTemplateRow {
  id: string;
  name: string;
  description: string | null;
  graph: SOPGraph;
  version: number;
  isActive: boolean;
  category: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface SopTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  category: string | null;
  createdBy: string;
  updatedAt: number;
}

export interface RawSopTemplateRow {
  id: string;
  name: string;
  description: string | null;
  graph_json: string;
  version: number;
  is_active: number;
  category: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export function mapSopTemplateRow(r: RawSopTemplateRow): SopTemplateRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    graph: JSON.parse(r.graph_json) as SOPGraph,
    version: r.version,
    isActive: r.is_active === 1,
    category: r.category,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
