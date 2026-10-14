import {
  Globe,
  BookOpen,
  Users,
  Palette,
  Building2,
} from 'lucide-react';

export const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  universe: { icon: Globe, label: 'Universe' },
  world: { icon: Globe, label: 'World' },
  series: { icon: BookOpen, label: 'Series' },
  character: { icon: Users, label: 'Character' },
  theme: { icon: Palette, label: 'Theme' },
  brand: { icon: Building2, label: 'Brand' },
};

export const STATUSES = [
  'draft',
  'planned',
  'in_production',
  'review',
  'approved',
  'published',
  'archived',
] as const;

export interface IpEntity {
  id: string;
  workspaceId: string;
  type: string;
  name: string;
  description: string;
  status: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface IpGraphTableProps {
  entities: IpEntity[];
  query: string;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  typeFilter: string;
  onStatusChange: (entity: IpEntity, status: string) => void;
  loading: boolean;
  t: (key: string) => string;
}
